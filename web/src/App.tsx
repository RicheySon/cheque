import { useEffect, useMemo, useState } from "react";
import {
  CONTRACT_ID,
  DEMO_DRAWER,
  EXPLORER,
  NATIVE_TOKEN,
  STATUS_ISSUED,
} from "./config";
import {
  amountInWords,
  formatWhen,
  formatXlm,
  isStellarAddress,
  parseXlm,
  shorten,
  statusLabel,
} from "./format";
import {
  cashCheque,
  connectWallet,
  getCheque,
  listPayable,
  listWritten,
  voidCheque,
  writeCheque,
  type Cheque,
} from "./stellar";

type Draft = {
  payee: string;
  amount: string;
  memo: string;
  expiry: string;
};

const EMPTY: Draft = {
  payee: "",
  amount: "20",
  memo: "For the market run",
  expiry: "0",
};

export function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [freighter, setFreighter] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [ledger, setLedger] = useState<Cheque[]>([]);
  const [payable, setPayable] = useState<Cheque[]>([]);
  const [written, setWritten] = useState<Cheque[]>([]);
  const [focus, setFocus] = useState<Cheque | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const previewAmount = parseXlm(draft.amount);

  function editDraft(patch: Partial<Draft>) {
    setFocus(null);
    setDraft({ ...draft, ...patch });
  }

  useEffect(() => {
    let cancelled = false;
    listWritten(DEMO_DRAWER)
      .then((rows) => {
        if (!cancelled) setLedger(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err));
      });
    const id = new URLSearchParams(window.location.search).get("cheque");
    if (id && /^\d+$/.test(id)) {
      getCheque(BigInt(id), DEMO_DRAWER)
        .then((cheque) => {
          if (!cancelled) setFocus(cheque);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(messageOf(err));
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshMine(address: string) {
    const [inbox, outbox] = await Promise.all([
      listPayable(address),
      listWritten(address),
    ]);
    setPayable(inbox);
    setWritten(outbox);
  }

  async function onConnect() {
    setError("");
    setBusy("Connecting Freighter…");
    try {
      const result = await connectWallet();
      setFreighter(result.freighter);
      if (!result.freighter) return;
      setAccount(result.address);
      await refreshMine(result.address);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy("");
    }
  }

  async function onWrite() {
    if (!account) return;
    const amount = parseXlm(draft.amount);
    const payee = draft.payee.trim();
    if (!isStellarAddress(payee)) {
      setError("Payee needs to be a Stellar address starting with G.");
      return;
    }
    if (payee === account) {
      setError("A cheque cannot be payable to the person who writes it.");
      return;
    }
    if (!amount) {
      setError("Enter an amount greater than zero, with up to 7 decimal places.");
      return;
    }
    const days = Number(draft.expiry);
    const expiresAt = days === 0 ? 0n : BigInt(Math.floor(Date.now() / 1000) + days * 86_400);
    setError("");
    setNotice("");
    setBusy("Escrowing the cheque…");
    try {
      const id = await writeCheque({
        drawer: account,
        payee,
        amount,
        memo: draft.memo.trim(),
        expiresAt,
      });
      setNotice(`Cheque ${id.toString()} is escrowed. Send the payee the link.`);
      try {
        await copyLink(id);
      } catch {
        setNotice(`Cheque ${id.toString()} is escrowed. Copy the link from the cheque.`);
      }
      const cheque = await getCheque(id, account);
      setFocus(cheque);
      await refreshMine(account);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy("");
    }
  }

  async function onCash(cheque: Cheque) {
    if (!account) return;
    setBusy(`Cashing cheque ${cheque.id.toString()}…`);
    setError("");
    try {
      await cashCheque(account, cheque.id);
      setNotice(`Cheque ${cheque.id.toString()} is cashed. The XLM is in your wallet.`);
      setFocus(await getCheque(cheque.id, account));
      await refreshMine(account);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy("");
    }
  }

  async function onVoid(cheque: Cheque) {
    if (!account) return;
    setBusy(`Voiding cheque ${cheque.id.toString()}…`);
    setError("");
    try {
      await voidCheque(account, cheque.id);
      setNotice(`Cheque ${cheque.id.toString()} is void. The escrow is back in your wallet.`);
      setFocus(await getCheque(cheque.id, account));
      await refreshMine(account);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy("");
    }
  }

  const preview = useMemo<Cheque>(
    () => ({
      id: 0n,
      drawer: account ?? "Your wallet",
      payee: draft.payee.trim() || "Payee wallet",
      token: NATIVE_TOKEN,
      amount: previewAmount ?? 0n,
      memo: draft.memo.trim() || "Memo",
      status: STATUS_ISSUED,
      issuedAt: BigInt(Math.floor(Date.now() / 1000)),
      expiresAt:
        draft.expiry === "0"
          ? 0n
          : BigInt(Math.floor(Date.now() / 1000) + Number(draft.expiry) * 86_400),
    }),
    [account, draft, previewAmount],
  );

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="mark">Cheque</p>
          <p className="tag">A paper cheque, settled on Stellar.</p>
        </div>
        <div className="top-actions">
          <a className="ghost" href={EXPLORER} target="_blank" rel="noreferrer">
            Contract {shorten(CONTRACT_ID)}
          </a>
          {account ? (
            <button className="account" type="button">
              {shorten(account)}
            </button>
          ) : (
            <button className="primary" type="button" onClick={onConnect} disabled={busy !== ""}>
              {freighter ? "Connect Freighter" : "Install Freighter"}
            </button>
          )}
        </div>
      </header>

      <section className="lede">
        <ol>
          <li>Write an amount to someone’s wallet.</li>
          <li>The tokens sit in escrow. They are not spent yet.</li>
          <li>They open the cheque and cash it. Or you void it.</li>
        </ol>
      </section>

      {!freighter && (
        <p className="banner">
          Freighter is not in this browser. Install it from{" "}
          <a href="https://freighter.app" target="_blank" rel="noreferrer">
            freighter.app
          </a>
          , switch the wallet to Testnet, then connect.
        </p>
      )}
      {error && <p className="banner bad">{error}</p>}
      {notice && <p className="banner good">{notice}</p>}
      {busy && <p className="banner">{busy}</p>}

      <main className="desk">
        <form
          className="slip"
          onSubmit={(event) => {
            event.preventDefault();
            void onWrite();
          }}
        >
          <h1>Write a cheque</h1>
          <label>
            Pay to the order of
            <input
              value={draft.payee}
              autoComplete="off"
              spellCheck={false}
              placeholder="G…"
              onChange={(event) => editDraft({ payee: event.target.value })}
            />
          </label>
          <label>
            Amount in XLM
            <input
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => editDraft({ amount: event.target.value })}
            />
          </label>
          <label>
            Memo
            <input
              maxLength={80}
              value={draft.memo}
              onChange={(event) => editDraft({ memo: event.target.value })}
            />
          </label>
          <label>
            Expiry
            <select
              value={draft.expiry}
              onChange={(event) => editDraft({ expiry: event.target.value })}
            >
              <option value="0">No expiry</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <button className="primary" type="submit" disabled={!account || busy !== ""}>
            {account ? "Escrow and sign" : "Connect a wallet to sign"}
          </button>
          <p className="fine">
            Testnet XLM only. The contract holds the amount until the payee cashes it or you void it.
          </p>
        </form>
        <ChequePaper cheque={focus ?? preview} live={focus === null} onCopy={focus ? () => copyLink(focus.id) : undefined} />
      </main>

      {focus && account && (
        <section className="actions">
          {focus.status === STATUS_ISSUED && focus.payee === account && (
            <button className="primary" type="button" onClick={() => onCash(focus)} disabled={busy !== ""}>
              Cash this cheque
            </button>
          )}
          {focus.status === STATUS_ISSUED && focus.drawer === account && (
            <button className="quiet" type="button" onClick={() => onVoid(focus)} disabled={busy !== ""}>
              Void and reclaim
            </button>
          )}
        </section>
      )}

      {account && (
        <section className="books">
          <Book
            title="Payable to you"
            empty="Nothing is waiting on your address."
            rows={payable}
            account={account}
            onOpen={setFocus}
            onCash={onCash}
            onVoid={onVoid}
            busy={busy !== ""}
          />
          <Book
            title="Cheques you wrote"
            empty="You have not written one from this wallet yet."
            rows={written}
            account={account}
            onOpen={setFocus}
            onCash={onCash}
            onVoid={onVoid}
            busy={busy !== ""}
          />
        </section>
      )}

      <section className="books">
        <Book
          title="Already on this contract"
          empty="No cheques have been written from the demo drawer."
          rows={ledger}
          account={account}
          onOpen={setFocus}
          onCash={onCash}
          onVoid={onVoid}
          busy={busy !== ""}
        />
      </section>
    </div>
  );
}

function ChequePaper({
  cheque,
  live,
  onCopy,
}: {
  cheque: Cheque;
  live: boolean;
  onCopy?: () => void;
}) {
  const label = statusLabel(cheque.status);
  return (
    <article className={`paper stamp-${label.toLowerCase()}`}>
      <div className="paper-head">
        <div>
          <p className="paper-bank">Cheque</p>
          <p className="paper-net">{live ? "Preview · not signed" : "Stellar testnet"}</p>
        </div>
        <p className="paper-no">No. {cheque.id === 0n ? "—" : cheque.id.toString()}</p>
      </div>
      <div className="pay-line">
        <span>Pay to the order of</span>
        <strong>{cheque.payee.startsWith("G") ? shorten(cheque.payee) : cheque.payee}</strong>
        <em>{cheque.amount > 0n ? `${formatXlm(cheque.amount)} XLM` : "—"}</em>
      </div>
      <p className="words">{cheque.amount > 0n ? amountInWords(cheque.amount) : "Amount in words"}</p>
      <p className="memo-line">Memo · {cheque.memo}</p>
      <div className="paper-foot">
        <div>
          <span>Drawer</span>
          <strong>{cheque.drawer.startsWith("G") ? shorten(cheque.drawer) : cheque.drawer}</strong>
          <span>{cheque.expiresAt === 0n ? "No expiry" : `Expires ${formatWhen(cheque.expiresAt)}`}</span>
        </div>
        <div className="stamp">{label}</div>
      </div>
      {onCopy && (
        <button className="linkish" type="button" onClick={onCopy}>
          Copy cheque link
        </button>
      )}
    </article>
  );
}

function Book({
  title,
  empty,
  rows,
  account,
  onOpen,
  onCash,
  onVoid,
  busy,
}: {
  title: string;
  empty: string;
  rows: Cheque[];
  account: string | null;
  onOpen: (cheque: Cheque) => void;
  onCash: (cheque: Cheque) => void;
  onVoid: (cheque: Cheque) => void;
  busy: boolean;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="rows">
          {rows.map((cheque) => (
            <li key={`${title}-${cheque.id.toString()}`}>
              <button className="row-main" type="button" onClick={() => onOpen(cheque)}>
                <span>No. {cheque.id.toString()}</span>
                <span>{formatXlm(cheque.amount)} XLM</span>
                <span>{cheque.memo}</span>
                <span className={`pill ${statusLabel(cheque.status).toLowerCase()}`}>
                  {statusLabel(cheque.status)}
                </span>
              </button>
              {account && cheque.status === STATUS_ISSUED && cheque.payee === account && (
                <button type="button" className="tiny" disabled={busy} onClick={() => onCash(cheque)}>
                  Cash
                </button>
              )}
              {account && cheque.status === STATUS_ISSUED && cheque.drawer === account && (
                <button type="button" className="tiny quiet" disabled={busy} onClick={() => onVoid(cheque)}>
                  Void
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function copyLink(id: bigint) {
  const url = new URL(window.location.href);
  url.search = `?cheque=${id.toString()}`;
  await navigator.clipboard.writeText(url.toString());
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "The network rejected that transaction.";
}
