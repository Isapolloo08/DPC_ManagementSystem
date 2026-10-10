import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { ModalShell } from '../../../components/common/ModalShell';

export function MemberDeleteDialog({ onClose, busy, children, footer }: {
  onClose: () => void; busy: boolean; children: ReactNode; footer: ReactNode;
}) {
  return <ModalShell title="Delete Member Record" size="sm" icon={<Trash2 />}
    subtitle="This action will remove the record permanently." className="member-delete-dialog"
    onClose={onClose} busy={busy} footer={footer}>{children}</ModalShell>;
}
