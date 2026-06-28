"use client";

import { useId } from "react";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { addComment, type CommentWithAuthor } from "@/app/actions/comments";
import {
  CommentSubmitSchema,
  type CommentSubmitData,
} from "@/lib/schemas/comment-submit";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

// Input type: zod's input (optional fields due to .default()) — this is what the form holds
type CommentFormInput = z.input<typeof CommentSubmitSchema>;

type CommentFormProps = {
  ticketId: string;
  onPosted: (comment: CommentWithAuthor) => void;
};

export default function CommentForm({ ticketId, onPosted }: CommentFormProps) {
  const formId = useId();

  // TFieldValues = input type (matching what standardSchemaResolver infers)
  // TTransformedValues = output type (what handleSubmit callback receives after zod parsing)
  const form = useForm<CommentFormInput, unknown, CommentSubmitData>({
    resolver: standardSchemaResolver(CommentSubmitSchema),
    mode: "onChange",
    defaultValues: {
      body: "",
      is_internal: false,
      cc_emails: [],
    },
  });

  const isInternal = form.watch("is_internal") ?? false;
  const rootError = form.formState.errors.root?.message;

  const handleSubmit = async (data: CommentSubmitData) => {
    try {
      const comment = await addComment({
        ticketId,
        body: data.body,
        is_internal: data.is_internal,
        cc_emails: data.cc_emails,
      });
      onPosted(comment);
      form.reset();
    } catch (err: any) {
      form.setError("root", {
        message: err?.message ?? t("dashboard.failedPostComment"),
      });
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isInternal
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/50",
      )}
    >
      {/* Form header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isInternal && (
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {isInternal ? t("dashboard.internalNote") : t("dashboard.reply")}
          </span>
        </div>

        <Controller
          name="is_internal"
          control={form.control}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`${formId}-internal`}
                className="cursor-pointer text-xs text-zinc-500"
              >
                {t("dashboard.internalNoteToggle")}
              </Label>
              <Switch
                id={`${formId}-internal`}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={form.formState.isSubmitting}
              />
            </div>
          )}
        />
      </div>

      {/* Body textarea */}
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)}>
        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <div className="mb-3 space-y-1.5">
              <Textarea
                {...field}
                id={`${formId}-body`}
                placeholder={
                  isInternal
                    ? t("dashboard.internalNotePlaceholder")
                    : t("dashboard.replyPlaceholder")
                }
                className={cn(
                  "min-h-[100px] resize-y",
                  isInternal &&
                    "border-amber-500/30 focus-visible:ring-amber-500/50",
                )}
                disabled={form.formState.isSubmitting}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
              />
              {fieldState.invalid && fieldState.error?.message && (
                <p className="text-xs text-rose-500">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        {rootError && <p className="mb-2 text-xs text-rose-500">{rootError}</p>}

        <div className="flex justify-end">
          <Button
            type="submit"
            form={formId}
            disabled={!form.formState.isValid || form.formState.isSubmitting}
            className={cn(
              isInternal &&
                "border-amber-600 bg-amber-600 text-white hover:bg-amber-700",
            )}
          >
            {form.formState.isSubmitting
              ? t("common.posting")
              : isInternal
                ? t("dashboard.addInternalNote")
                : t("dashboard.reply")}
          </Button>
        </div>
      </form>
    </div>
  );
}
