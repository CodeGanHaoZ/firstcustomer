"use client";

import { useLocale } from "@/components/locale-provider";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function ImageUploadInput({ id, name, maxTotalBytes, multiple, required }: {
  id: string;
  name: string;
  maxTotalBytes?: number;
  multiple?: boolean;
  required?: boolean;
}) {
  const locale = useLocale();
  const [error, setError] = useState("");
  const errorId = `${id}-size-error`;
  return (
    <>
      <Input id={id} name={name} type="file" accept="image/png,image/jpeg,image/webp" multiple={multiple} required={required}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => {
          const input = event.currentTarget;
          const total = Array.from(input.files ?? []).reduce((sum, file) => sum + file.size, 0);
          const message = maxTotalBytes && total > maxTotalBytes ? "文件总大小超过 4 MB，请选更小的图片。" : "";
          input.setCustomValidity(translateUi(locale, message));
          setError(message);
        }} />
      {error && <p id={errorId} role="alert" className="text-sm text-destructive"><T>{error}</T></p>}
    </>
  );
}
