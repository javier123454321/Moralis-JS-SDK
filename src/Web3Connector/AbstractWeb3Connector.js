/* eslint-disable no-console */
import EventEmitter from 'events';
import verifyChainId from '../utils/verifyChainId';
import { ConnectorEvents, ProviderEvents } from './events';

/**
 * Abstract connector to connect EIP-1193 providers to Moralis
 *
 * It must implement at least:
 * - activate()
 *
 * It should implement:
 * - Emit ConnectorEvent.CHAIN_CHANGED when the chain has changed
 * - Emit ConnectorEvent.ACCOUNT_CHANGED when the account has changed
 * - deactivate(): to cleanup event listeners and stale references
 * - type: a name to identify
 * - network: the network type that is used (eg. evm)
 */
class AbstractWeb3Connector extends EventEmitter {
  type = 'abstract';
  network = null;
  account = null;
  chainId = null;

  constructor() {
    super();
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
    this.handleChainChanged = this.handleChainChanged.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
  }

  subscribeToEvents(provider) {
    if (provider && provider.on) {
      provider.on(ProviderEvents.CHAIN_CHANGED, this.handleChainChanged);
      provider.on(ProviderEvents.ACCOUNTS_CHANGED, this.handleAccountsChanged);
      provider.on(ProviderEvents.CONNECT, this.handleConnect);
      provider.on(ProviderEvents.DISCONNECT, this.handleDisconnect);
    }
  }

  unsubscribeToEvents(provider) {
    if (provider && provider.removeListener) {
      provider.removeListener(ProviderEvents.CHAIN_CHANGED, this.handleChainChanged);
      provider.removeListener(ProviderEvents.ACCOUNTS_CHANGED, this.handleAccountsChanged);
      provider.removeListener(ProviderEvents.CONNECT, this.handleConnect);
      provider.removeListener(ProviderEvents.DISCONNECT, this.handleDisconnect);
    }
  }

  /**
   * Activates the provider.
   * Should returns an object with:
   * - provider: A valid EIP-1193 provider
   * - chainId(optional): the chainId that has been connected to (in hex format)
   * - account(optional): the address that is connected to the provider
   */
  async activate() {
    throw new Error('Not implemented: activate()');
  }

  /**
   * Updates account and emit event, on EIP-1193 accountsChanged events
   */
  handleAccountsChanged(accounts) {
    const account = accounts && accounts[0] ? accounts[0].toLowerCase() : null;
    this.account = account;
    this.emit(ConnectorEvents.ACCOUNT_CHANGED, account);
  }

  /**
   * Updates chainId and emit event, on EIP-1193 accountsChanged events
   */
  handleChainChanged(chainId) {
    const newChainId = verifyChainId(chainId);
    this.chainId = newChainId;
    this.emit(ConnectorEvents.CHAIN_CHANGED, newChainId);
  }

  handleConnect(connectInfo) {
    this.emit(ConnectorEvents.CONNECT, connectInfo);
  }

  handleDisconnect(error) {
    this.emit(ConnectorEvents.DISCONNECT, error);
  }

  /**
   * Cleans all active listners, connections and stale references
   */
  async deactivate() {
    this.unsubscribeToEvents(this.provider);

    this.account = null;
    this.chainId = null;
  }
}

export default AbstractWeb3Connector;
