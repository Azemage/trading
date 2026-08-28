"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import {
  approveDeposit,
  markWithdrawalSent,
  rejectDeposit,
  rejectWithdrawal,
} from "@/lib/movements";
import { adjustPoolAssets, logManualTrade } from "@/lib/trades";
import { ALLOWED_LEVERAGES, computePositionPnlPct } from "@/lib/position";
import { createTestClient } from "@/lib/test-clients";
import { resetAllTestData } from "@/lib/admin-reset";
import { reviewKyc } from "@/lib/kyc";
import { sendEmail, emailTemplates, getEmailT } from "@/lib/email";
import { translateActionError } from "@/lib/error-i18n";
import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import type { TradeDirection } from "@prisma/client";
import type { Locale } from "@/i18n/config";

async function getMovementClient(movementId: string) {
  const movement = await prisma.pendingMovement.findUniqueOrThrow({
    where: { id: movementId },
    include: { client: { select: { name: true, email: true, preferredLocale: true } } },
  });
  return {
    email: movement.client.email,
    name: movement.client.name,
    preferredLocale: movement.client.preferredLocale,
    amount: (movement.grantedAmount ?? movement.amount).toNumber(),
  };
}

async function requireManager() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MANAGER") {
    throw new AppError("UNAUTHENTICATED");
  }
  return session.user;
}

async function defaultRejectReason() {
  const t = await getTranslations("manager");
  return t("defaultRejectReason");
}

export async function approveDepositAction(movementId: string) {
  const manager = await requireManager();
  await approveDeposit(movementId, manager.id);
  const c = await getMovementClient(movementId);
  const t = await getEmailT(c.preferredLocale);
  const { subject, html } = emailTemplates.depositApproved(t, c.preferredLocale as Locale, c.name, c.amount);
  await sendEmail({ to: c.email, subject, html });
  revalidatePath("/manager");
}

export async function rejectDepositAction(movementId: string, formData: FormData) {
  const manager = await requireManager();
  const reason = String(formData.get("reason") ?? "") || (await defaultRejectReason());
  await rejectDeposit(movementId, manager.id, reason);
  const c = await getMovementClient(movementId);
  const t = await getEmailT(c.preferredLocale);
  const { subject, html } = emailTemplates.depositRejected(t, c.preferredLocale as Locale, c.name, c.amount, reason);
  await sendEmail({ to: c.email, subject, html });
  revalidatePath("/manager");
}

export async function sendWithdrawalAction(movementId: string, formData: FormData) {
  const manager = await requireManager();
  const txHash = String(formData.get("txHash") ?? "");
  await markWithdrawalSent(movementId, manager.id, txHash);
  const c = await getMovementClient(movementId);
  const t = await getEmailT(c.preferredLocale);
  const { subject, html } = emailTemplates.withdrawalSent(t, c.preferredLocale as Locale, c.name, c.amount, txHash);
  await sendEmail({ to: c.email, subject, html });
  revalidatePath("/manager");
}

export async function rejectWithdrawalAction(movementId: string, formData: FormData) {
  const manager = await requireManager();
  const reason = String(formData.get("reason") ?? "") || (await defaultRejectReason());
  await rejectWithdrawal(movementId, manager.id, reason);
  const c = await getMovementClient(movementId);
  const t = await getEmailT(c.preferredLocale);
  const { subject, html } = emailTemplates.withdrawalRejected(t, c.preferredLocale as Locale, c.name, c.amount, reason);
  await sendEmail({ to: c.email, subject, html });
  revalidatePath("/manager");
}

export async function logTradeAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const te = await getTranslations("errors");
  try {
    const manager = await requireManager();
    const note = String(formData.get("note") ?? "");
    const mode = String(formData.get("mode") ?? "simple");

    const tradingFeeRaw = String(formData.get("tradingFeeUsd") ?? "").trim();
    const tradingFeeUsd = tradingFeeRaw ? Number(tradingFeeRaw) : 0;
    if (Number.isNaN(tradingFeeUsd) || tradingFeeUsd < 0) {
      return { error: te("TRADE_FEE_INVALID") };
    }

    if (mode === "position") {
      const pair = String(formData.get("pair") ?? "").trim();
      const direction = String(formData.get("direction") ?? "LONG") as TradeDirection;
      const entryPrice = Number(formData.get("entryPrice"));
      const exitPrice = Number(formData.get("exitPrice"));
      const positionSizePct = Number(formData.get("positionSizePct"));

      if (!pair) return { error: te("TRADE_PAIR_REQUIRED") };
      if ([entryPrice, exitPrice, positionSizePct].some((n) => Number.isNaN(n))) {
        return { error: te("TRADE_PRICES_NOT_NUMERIC") };
      }
      if (positionSizePct <= 0 || positionSizePct > 100) {
        return { error: te("TRADE_POSITION_SIZE_RANGE") };
      }
      const leverage = Number(formData.get("leverage") ?? "1");
      if (!ALLOWED_LEVERAGES.includes(leverage as (typeof ALLOWED_LEVERAGES)[number])) {
        return { error: te("TRADE_INVALID_LEVERAGE") };
      }

      const entryPriceD = new Decimal(entryPrice);
      const exitPriceD = new Decimal(exitPrice);
      const leverageD = new Decimal(leverage);
      const { pnlPctOfAum } = computePositionPnlPct({
        entryPrice: entryPriceD,
        exitPrice: exitPriceD,
        positionSizePct: new Decimal(positionSizePct),
        direction,
        leverage: leverageD,
      });

      await logManualTrade({
        pnlPct: pnlPctOfAum,
        note: note || undefined,
        loggedById: manager.id,
        tradingFeeUsd: new Decimal(tradingFeeUsd),
        position: {
          pair,
          direction,
          entryPrice: entryPriceD,
          exitPrice: exitPriceD,
          positionSizePct: new Decimal(positionSizePct),
          leverage: leverageD,
        },
      });
    } else {
      const pnlPct = Number(formData.get("pnlPct"));
      if (Number.isNaN(pnlPct)) return { error: te("TRADE_INVALID_RESULT") };
      await logManualTrade({
        pnlPct: new Decimal(pnlPct),
        note: note || undefined,
        loggedById: manager.id,
        tradingFeeUsd: new Decimal(tradingFeeUsd),
      });
    }

    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
  }
}

export async function adjustPoolAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const manager = await requireManager();
    const newTotalAssets = Number(formData.get("newTotalAssets"));
    const reason = String(formData.get("reason") ?? "");
    if (Number.isNaN(newTotalAssets)) return { error: await translateActionError(new AppError("MOVEMENT_INVALID_AMOUNT")) };

    await adjustPoolAssets({
      newTotalAssets: new Decimal(newTotalAssets),
      reason,
      managerId: manager.id,
    });
    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
  }
}

export async function createTestClientAction(
  _prevState: { error: string | null; created: { email: string; password: string } | null },
  formData: FormData
): Promise<{ error: string | null; created: { email: string; password: string } | null }> {
  const te = await getTranslations("errors");
  try {
    const manager = await requireManager();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const initialDeposit = Number(formData.get("initialDeposit"));

    if (!name) return { error: te("TEST_CLIENT_NAME_REQUIRED"), created: null };
    if (!email) return { error: te("TEST_CLIENT_EMAIL_REQUIRED"), created: null };
    if (password.length < 8) return { error: te("TEST_CLIENT_PASSWORD_TOO_SHORT"), created: null };
    if (Number.isNaN(initialDeposit) || initialDeposit < 0) {
      return { error: te("TEST_CLIENT_NEGATIVE_DEPOSIT"), created: null };
    }

    await createTestClient({
      name,
      email,
      password,
      initialDeposit: new Decimal(initialDeposit),
      managerId: manager.id,
    });

    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null, created: { email: email.toLowerCase(), password } };
  } catch (e) {
    return { error: await translateActionError(e), created: null };
  }
}

export async function reviewKycAction(submissionId: string, formData: FormData) {
  const manager = await requireManager();
  const approve = String(formData.get("decision") ?? "") === "approve";
  const reason = String(formData.get("reason") ?? "");

  await reviewKyc({ submissionId, approve, reason, managerId: manager.id });

  const submission = await prisma.kycSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { client: { select: { name: true, email: true, preferredLocale: true } } },
  });
  const t = await getEmailT(submission.client.preferredLocale);
  const { subject, html } = approve
    ? emailTemplates.kycApproved(t, submission.client.name)
    : emailTemplates.kycRejected(t, submission.client.name, reason);
  await sendEmail({ to: submission.client.email, subject, html });

  revalidatePath("/manager");
}

export async function resetAllTestDataAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const te = await getTranslations("errors");
  try {
    const manager = await requireManager();
    const confirmation = String(formData.get("confirm") ?? "");
    if (confirmation !== "RESET") {
      return { error: te("RESET_CONFIRMATION_MISMATCH") };
    }

    await resetAllTestData(manager.id);
    revalidatePath("/manager");
    revalidatePath("/client");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
  }
}
