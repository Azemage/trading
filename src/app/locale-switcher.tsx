"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";

const FLAGS: { locale: Locale; flag: string; label: string }[] = [
  { locale: "fr", flag: "🇫🇷", label: "Français" },
  { locale: "en", flag: "🇬🇧", label: "English" },
  { locale: "es", flag: "🇪🇸", label: "Español" },
];

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(locale: Locale) {
    if (locale === currentLocale || pending) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      {FLAGS.map((f) => (
        <button
          key={f.locale}
          type="button"
          title={f.label}
          aria-label={f.label}
          onClick={() => handleClick(f.locale)}
          disabled={pending}
          className={`text-base leading-none px-1 py-0.5 rounded ${
            f.locale === currentLocale ? "opacity-100 ring-1 ring-line" : "opacity-50 hover:opacity-100"
          }`}
        >
          {f.flag}
        </button>
      ))}
    </div>
  );
}
