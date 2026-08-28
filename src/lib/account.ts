import { prisma } from "./prisma";
import { validateUsdcAddress, type UsdcNetworkValue } from "./usdc";
import { logAudit } from "./audit";
import { Role } from "@prisma/client";
import { AppError } from "./app-error";

export class AccountError extends AppError {}

export async function updateUsdcAddress(params: {
  clientId: string;
  network: UsdcNetworkValue;
  address: string;
}) {
  const { valid, error } = validateUsdcAddress(params.network, params.address);
  if (!valid) throw new AccountError(error ?? "USDC_ADDRESS_INVALID");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.clientId },
      data: { usdcNetwork: params.network, usdcAddress: params.address.trim() },
    });
    await logAudit(tx, {
      actorId: params.clientId,
      actorRole: Role.CLIENT,
      action: "account.usdc_address_updated",
      entityType: "User",
      entityId: params.clientId,
      details: { network: params.network },
    });
  });
}
