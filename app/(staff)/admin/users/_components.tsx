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
  type UserRow,
} from "@/app/actions/admin";
import {
  adminInviteSchema,
  type AdminInviteData,
} from "@/lib/schemas/admin-invite";

// ---------------------------------------------------------------------------
// UsersTable
// ---------------------------------------------------------------------------

export function UsersTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">No users found.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.display_name ?? "—"}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <span className={getRoleBadgeClass(user.role)}>
                {user.role}
              </span>
            </TableCell>
            <TableCell>
              <span className={getStatusBadgeClass(user.is_active)}>
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </TableCell>
            <TableCell>
              {new Date(user.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              {user.is_active ? (
                <DeactivateButton userId={user.id} />
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

function getStatusBadgeClass(isActive: boolean) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
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
      toast.error(e instanceof Error ? e.message : "Failed to send invitation.");
      return;
    }

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Invitation sent.");
    form.reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation email to a new staff member.
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
                  <FormLabel>Email</FormLabel>
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
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={form.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="it">IT</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
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
            {form.formState.isSubmitting ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DeactivateButton
// ---------------------------------------------------------------------------

export function DeactivateButton({ userId }: { userId: string }) {
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
    toast.success("User deactivated.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Deactivate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate User</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate this user? They will no longer
            be able to access the system.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Deactivating..." : "Deactivate"}
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
    toast.success("User reactivated.");
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Reactivating..." : "Reactivate"}
    </Button>
  );
}
