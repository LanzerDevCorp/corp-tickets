"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteUser } from "@/app/actions/auth";
import {
  deactivateUser,
  reactivateUser,
  reinviteStaffUser,
  cancelStaffInvite,
  type UserRow,
} from "@/app/actions/admin";
import {
  adminInviteSchema,
  type AdminInviteData,
} from "@/lib/schemas/admin-invite";
import { formatDate } from "@/lib/format-date";
import { t } from "@/lib/i18n/t";
import { roleLabel } from "@/lib/i18n/maps";

// ---------------------------------------------------------------------------
// UsersTable
// ---------------------------------------------------------------------------

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId?: string;
}) {
  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        {t("admin.noUsers")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.name")}</TableHead>
          <TableHead>{t("common.email")}</TableHead>
          <TableHead>{t("admin.role")}</TableHead>
          <TableHead>{t("admin.status")}</TableHead>
          <TableHead>{t("admin.joined")}</TableHead>
          <TableHead>{t("common.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.display_name ?? "—"}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <span className={getRoleBadgeClass(user.role)}>
                {roleLabel(user.role)}
              </span>
            </TableCell>
            <TableCell>
              <span
                className={getStatusBadgeClass(
                  user.is_pending_invite,
                  user.is_active,
                )}
              >
                {getStatusLabel(user.is_pending_invite, user.is_active)}
              </span>
            </TableCell>
            <TableCell>{formatDate(user.created_at)}</TableCell>
            <TableCell>
              {user.is_pending_invite ? (
                <div className="flex gap-2">
                  <ReinviteButton userId={user.id} />
                  <CancelInviteButton userId={user.id} />
                </div>
              ) : user.is_active ? (
                <DeactivateButton
                  userId={user.id}
                  isSelf={user.id === currentUserId}
                />
              ) : (
                <ReactivateButton userId={user.id} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function getRoleBadgeClass(role: UserRow["role"]) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  switch (role) {
    case "admin":
      return `${base} bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300`;
    case "it":
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
    default:
      return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
  }
}

function getStatusLabel(isPendingInvite: boolean, isActive: boolean) {
  if (isPendingInvite) return t("admin.pending");
  return isActive ? t("admin.active") : t("admin.inactive");
}

function getStatusBadgeClass(isPendingInvite: boolean, isActive: boolean) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (isPendingInvite) {
    return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`;
  }
  return isActive
    ? `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`
    : `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
}

// ---------------------------------------------------------------------------
// InviteUserDialog
// ---------------------------------------------------------------------------

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const formId = useId();

  const form = useForm<AdminInviteData>({
    resolver: standardSchemaResolver(adminInviteSchema),
    mode: "onChange",
    defaultValues: { email: "", role: "it" },
  });

  const onSubmit = async (data: AdminInviteData) => {
    const parsed = adminInviteSchema.safeParse(data);
    if (!parsed.success) {
      form.trigger();
      return;
    }

    let result: { error: string | null };
    try {
      result = await inviteUser(parsed.data.email, parsed.data.role);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("admin.failedSendInvitation"),
      );
      return;
    }

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(t("admin.invitationSent"));
    form.reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("admin.inviteUser")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.inviteUserTitle")}</DialogTitle>
          <DialogDescription>
            {t("admin.inviteUserDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="staff@corp.com"
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.role")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={form.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.selectRole")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="it">{roleLabel("it")}</SelectItem>
                      <SelectItem value="admin">
                        {roleLabel("admin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            disabled={!form.formState.isValid || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? t("common.sending")
              : t("admin.sendInvitation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ReinviteButton
// ---------------------------------------------------------------------------

export function ReinviteButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    const result = await reinviteStaffUser(userId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("admin.invitationResent"));
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? t("common.sending") : t("admin.reinvite")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// CancelInviteButton
// ---------------------------------------------------------------------------

export function CancelInviteButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConfirm = async () => {
    setLoading(true);
    const result = await cancelStaffInvite(userId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("admin.invitationCancelled"));
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          {t("admin.cancelInvite")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.cancelInviteTitle")}</DialogTitle>
          <DialogDescription>
            {t("admin.cancelInviteDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("admin.keepInvitation")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? t("admin.cancelling") : t("admin.cancelInvitation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DeactivateButton
// ---------------------------------------------------------------------------

export function DeactivateButton({
  userId,
  isSelf,
}: {
  userId: string;
  isSelf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConfirm = async () => {
    setLoading(true);
    const result = await deactivateUser(userId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("admin.userDeactivated"));
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isSelf}>
          {t("admin.deactivate")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.deactivateTitle")}</DialogTitle>
          <DialogDescription>
            {t("admin.deactivateDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? t("admin.deactivating") : t("admin.deactivate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ReactivateButton
// ---------------------------------------------------------------------------

export function ReactivateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    const result = await reactivateUser(userId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("admin.userReactivated"));
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? t("admin.reactivating") : t("admin.reactivate")}
    </Button>
  );
}
