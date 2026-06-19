"use client";

import { useId, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addComment, type CommentWithAuthor } from "@/app/actions/comments";
import { CommentSubmitSchema } from "@/lib/schemas/comment-submit";

const ClientCommentFormSchema = CommentSubmitSchema.omit({
  is_internal: true,
}).extend({
  cc_emails_raw: z.string().default(""),
});

type ClientCommentFormInput = z.input<typeof ClientCommentFormSchema>;

type ClientCommentFormProps = {
  ticketId: string;
  disabled?: boolean;
  onPosted: (comment: CommentWithAuthor) => void;
};

function parseCcEmails(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export default function ClientCommentForm({
  ticketId,
  disabled = false,
  onPosted,
}: ClientCommentFormProps) {
  const formId = useId();
  const [ccParseError, setCcParseError] = useState<string | null>(null);

  const form = useForm<ClientCommentFormInput>({
    resolver: standardSchemaResolver(ClientCommentFormSchema),
    mode: "onChange",
    defaultValues: {
      body: "",
      cc_emails_raw: "",
    },
  });

  const rootError = form.formState.errors.root?.message;

  const handleSubmit = async (data: ClientCommentFormInput) => {
    setCcParseError(null);

    const ccEmails = parseCcEmails(data.cc_emails_raw ?? "");
    for (const email of ccEmails) {
      const result = z.string().email().safeParse(email);
      if (!result.success) {
        setCcParseError(`Invalid email address: ${email}`);
        return;
      }
    }

    const bodyCheck = CommentSubmitSchema.shape.body.safeParse(data.body);
    if (!bodyCheck.success) {
      form.setError("body", {
        message: bodyCheck.error.issues[0]?.message ?? "Invalid comment",
      });
      return;
    }

    try {
      const comment = await addComment({
        ticketId,
        body: bodyCheck.data,
        is_internal: false,
        cc_emails: ccEmails,
      });
      onPosted(comment);
      form.reset();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to post comment";
      form.setError("root", { message });
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <h4 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Add a comment
      </h4>

      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)}>
        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <div className="mb-3 space-y-1.5">
              <Label htmlFor={`${formId}-body`} className="sr-only">
                Comment
              </Label>
              <Textarea
                {...field}
                id={`${formId}-body`}
                placeholder="Share additional details or reply to the team..."
                className="min-h-[100px] resize-y"
                disabled={disabled || form.formState.isSubmitting}
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

        <Controller
          name="cc_emails_raw"
          control={form.control}
          render={({ field }) => (
            <div className="mb-3 space-y-1.5">
              <Label htmlFor={`${formId}-cc`} className="text-xs text-zinc-500">
                CC (optional, comma-separated emails)
              </Label>
              <Input
                {...field}
                id={`${formId}-cc`}
                type="text"
                placeholder="colleague@company.com, manager@company.com"
                disabled={disabled || form.formState.isSubmitting}
                autoComplete="off"
              />
            </div>
          )}
        />

        {(ccParseError || rootError) && (
          <p className="mb-2 text-xs text-rose-500">{ccParseError ?? rootError}</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            form={formId}
            disabled={
              disabled ||
              !form.formState.isValid ||
              form.formState.isSubmitting
            }
          >
            {form.formState.isSubmitting ? "Posting..." : "Post comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
