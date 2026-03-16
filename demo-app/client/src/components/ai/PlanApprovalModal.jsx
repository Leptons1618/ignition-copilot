import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, HelpCircle, RefreshCw } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

function summarizeTarget(op = {}) {
  return op.path
    || op.viewPath
    || op.scriptPath
    || op.queryPath
    || op.tagPath
    || op.name
    || op.project
    || '-';
}

export default function PlanApprovalModal({
  open = false,
  plan = null,
  busy = false,
  error = '',
  title = 'Approve AI Plan',
  approveLabel = 'Approve & Apply',
  rejectLabel = 'Reject',
  onApprove,
  onClose,
}) {
  if (!open || !plan) return null;

  const operations = Array.isArray(plan.operations) ? plan.operations : [];
  const questions = Array.isArray(plan.questions) ? plan.questions : [];
  const preview = Array.isArray(plan.preview) ? plan.preview : [];

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {plan.project && <Badge color="info">Project: {plan.project}</Badge>}
          <Badge color="neutral">{operations.length} operations</Badge>
          {plan.expiresAt && <Badge color="warning">Expires: {new Date(plan.expiresAt).toLocaleTimeString()}</Badge>}
        </div>

        {plan.summary && (
          <div className="p-3 rounded-lg border t-border-s t-bg-alt text-sm t-text-2">
            {plan.summary}
          </div>
        )}

        {questions.length > 0 && (
          <div className="rounded-lg border t-border-s p-3">
            <div className="text-xs uppercase font-semibold t-text-m mb-2 inline-flex items-center gap-1.5">
              <HelpCircle size={12} />
              Questions from AI
            </div>
            <ul className="space-y-1 text-sm t-text-2 list-disc pl-5">
              {questions.map((q, idx) => (
                <li key={`${q}-${idx}`}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg border t-border-s overflow-hidden">
          <div className="px-3 py-2 border-b t-border-s text-xs uppercase font-semibold t-text-m inline-flex items-center gap-1.5">
            <ClipboardList size={12} />
            Planned Operations
          </div>
          <div className="max-h-64 overflow-y-auto divide-y t-border-s">
            {operations.length === 0 && (
              <div className="px-3 py-2 text-sm t-text-m">No operations in this plan.</div>
            )}
            {operations.map((op, idx) => (
              <div key={`${op.type}-${idx}`} className="px-3 py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-mono t-text">{op.type}</div>
                  <div className="text-xs t-text-m truncate">{summarizeTarget(op)}</div>
                </div>
                {op.project && (
                  <Badge color="neutral" className="shrink-0">
                    {op.project}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {preview.length > 0 && (
          <div className="rounded-lg border t-border-s overflow-hidden">
            <div className="px-3 py-2 border-b t-border-s text-xs uppercase font-semibold t-text-m">
              Preview
            </div>
            <div className="max-h-56 overflow-y-auto divide-y t-border-s">
              {preview.map((entry, idx) => (
                <pre key={idx} className="m-0 p-3 text-xs t-text-2 t-bg-alt overflow-x-auto">
                  {JSON.stringify(entry, null, 2)}
                </pre>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border t-err-border t-err-soft text-sm t-err inline-flex items-start gap-2 w-full">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {rejectLabel}
          </Button>
          <Button variant="primary" onClick={onApprove} disabled={busy || !plan.planId}>
            {busy ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            {approveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
