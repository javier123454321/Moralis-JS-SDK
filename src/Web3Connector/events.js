// Events being emitted by a eip-1193 provider
// See https://eips.ethereum.org/EIPS/eip-1193#events
export const EthereumEvents = Object.freeze({
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CHAIN_CHANGED: 'chainChanged',
  ACCOUNTS_CHANGED: 'accountsChanged',
});

// Events emitted by the connectors, Moralis will listen to these
export const ConnectorEvents = Object.freeze({
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CHAIN_CHANGED: 'chainChanged',
  ACCOUNT_CHANGED: 'accountChanged',
});
