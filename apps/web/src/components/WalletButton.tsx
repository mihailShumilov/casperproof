/**
 * Wallet connect / disconnect control. Backed by the mock CSPR.click connector
 * (`@/lib/wallet`); shows the connected demo account or a connect button.
 */
'use client';

import { Button, HashDisplay, Spinner } from '@casperproof/ui';
import { useWallet } from '@/lib/wallet';

export function WalletButton(): JSX.Element {
  const { status, account, connect, disconnect } = useWallet();

  if (status === 'connecting') {
    return (
      <Button variant="secondary" size="sm" disabled aria-busy="true">
        <Spinner size="sm" label="Connecting wallet" /> Connecting…
      </Button>
    );
  }

  if (status === 'connected' && account) {
    return (
      <span className="wallet-pill">
        <span className="wallet-account">
          <span className="wallet-account__label">{account.label}</span>
          <span className="wallet-account__key">
            <HashDisplay hash={account.publicKey} prefix="" lead={12} tail={6} copyable={false} />
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </span>
    );
  }

  return (
    <Button variant="primary" size="sm" onClick={() => void connect()}>
      Connect wallet
    </Button>
  );
}
