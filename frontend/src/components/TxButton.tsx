import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
};

export function TxButton({ children, onClick, disabled, pending }: Props) {
  return (
    <button
      type="button"
      className="tx-button"
      onClick={onClick}
      disabled={disabled || pending}
    >
      {pending ? "Waiting for wallet..." : children}
    </button>
  );
}
