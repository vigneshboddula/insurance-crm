"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { updateClient } from "@/app/clients/actions";
import { INCOME_BANDS, RELATIONSHIPS, GENDERS } from "@/lib/enums";

export type ClientDefaults = {
  id: string; name: string; phone: string; altPhone: string; email: string; dob: string;
  occupation: string; incomeBand: string; gender: string; relationship: string; tags: string; address: string; householdId: string;
  instagram: string; linkedin: string; facebook: string;
};

export function EditClientDialog({ open, onClose, client }: { open: boolean; onClose: () => void; client: ClientDefaults; households?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => { await updateClient(fd); onClose(); router.refresh(); });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit client" wide>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="id" value={client.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" required><Input name="name" required defaultValue={client.name} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={client.phone} /></Field>
          <Field label="Alternative phone"><Input name="altPhone" defaultValue={client.altPhone} /></Field>
          <Field label="Email"><Input name="email" type="email" defaultValue={client.email} /></Field>
          <Field label="Date of birth"><Input name="dob" type="date" defaultValue={client.dob} /></Field>
          <Field label="Occupation"><Input name="occupation" defaultValue={client.occupation} /></Field>
          <Field label="Income band"><Select name="incomeBand" options={INCOME_BANDS} placeholder="Select…" defaultValue={client.incomeBand} /></Field>
          <Field label="Gender"><Select name="gender" options={GENDERS} placeholder="Select…" defaultValue={client.gender} /></Field>
          <Field label="Relationship in family"><Select name="relationship" options={RELATIONSHIPS} placeholder="Select…" defaultValue={client.relationship} /></Field>
        </div>
        <Field label="Tags" hint="Comma-separated"><Input name="tags" defaultValue={client.tags} /></Field>
        <Field label="Address"><Textarea name="address" rows={2} defaultValue={client.address} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Instagram"><Input name="instagram" defaultValue={client.instagram} placeholder="@handle or URL" /></Field>
          <Field label="LinkedIn"><Input name="linkedin" defaultValue={client.linkedin} placeholder="profile URL" /></Field>
          <Field label="Facebook"><Input name="facebook" defaultValue={client.facebook} placeholder="profile URL" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
