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
import { roleLabel } from "@/lib/labels";

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
        {"No se encontraron usuarios."}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{"Nombre"}</TableHead>
          <TableHead>{"Correo electrónico"}</TableHead>
          <TableHead>{"Rol"}</TableHead>
          <TableHead>{"Estado"}</TableHead>
          <TableHead>{"Registro"}</TableHead>
          <TableHead>{"Acciones"}</TableHead>
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
  if (isPendingInvite) return "Pendiente";
  return isActive ? "Activo" : "Inactivo";
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
        e instanceof Error ? e.message : "No se pudo enviar la invitación.",
      );
      return;
    }

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Invitación enviada.");
    form.reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{"Invitar usuario"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Invitar usuario"}</DialogTitle>
          <DialogDescription>
            {"Envía un correo de invitación a un nuevo miembro del personal."}
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
                  <FormLabel>{"Correo electrónico"}</FormLabel>
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
                  <FormLabel>{"Rol"}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={form.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={"Seleccionar rol"} />
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
            {form.formState.isSubmitting ? "Enviando..." : "Enviar invitación"}
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
    toast.success("Invitación reenviada.");
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Enviando..." : "Reinvitar"}
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
    toast.success("Invitación cancelada.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          {"Cancelar invitación"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Cancelar invitación"}</DialogTitle>
          <DialogDescription>
            {
              "Esto eliminará la cuenta pendiente. Puedes volver a invitar este correo después."
            }
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {"Mantener invitación"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Cancelando..." : "Cancelar invitación"}
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
    toast.success("Usuario desactivado.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isSelf}>
          {"Desactivar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Desactivar usuario"}</DialogTitle>
          <DialogDescription>
            {
              "¿Seguro que deseas desactivar este usuario? Ya no podrá acceder al sistema."
            }
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {"Cancelar"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Desactivando..." : "Desactivar"}
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
    toast.success("Usuario reactivado.");
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Reactivando..." : "Reactivar"}
    </Button>
  );
}
