// TODO: make all events compatible with eip-1193 provider?

// Events emitted by Moralis
export const Web3Events = Object.freeze({
  ACCOUNT_CHANGED: 'accountChanged',
  CHAIN_CHANGED: 'chainChanged',
  // Provider is connected
  CONNECT: 'connect',
  // Provider is disconnected
  DISCONNECT: 'disconnect',
  // web3 is enabled
  WEB3_ENABLED: 'web3Enabled',
  // web3 is deactivated
  WEB3_DEACTIVATED: 'web3Deactivated',
});

// Events being emitted by a eip-1193 provider
// See https://eips.ethereum.org/EIPS/eip-1193#events
export const ProviderEvents = Object.freeze({
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CHAIN_CHANGED: 'chainChanged',
  ACCOUNTS_CHANGED: 'accountsChanged',
});

// Events emitted by the connectors
// Moralis will listen to these
export const ConnectorEvents = Object.freeze({
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CHAIN_CHANGED: 'chainChanged',
  ACCOUNT_CHANGED: 'accountChanged',
  // DEACTIVATE: 'deactivate',
});
