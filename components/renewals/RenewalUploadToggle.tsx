"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { BulkUpload } from "@/components/policies/BulkUpload";

/** Collapsible renewal-notice upload for the Renewals page. Renewal notices are
 *  uploaded ONLY here — they attach to policies already in the system. */
export function RenewalUploadToggle() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setOpen((v) => !v)} className="btn"><Upload size={15} /> {open ? "Hide upload" : "Upload renewal notices"}</button>
      </div>
      {open && <BulkUpload mode="renewals" />}
    </div>
  );
}
