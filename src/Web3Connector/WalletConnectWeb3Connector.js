/* global window */
import CoreManager from '../CoreManager';
import verifyChainId from '../utils/verifyChainId';
import AbstractWeb3Connector from './AbstractWeb3Connector';
import { ConnectorEvent } from './events';
import { getMoralisRpcs } from './MoralisRpcs';

export const WalletConnectEvent = Object.freeze({
  ACCOUNTS_CHANGED: 'accountsChanged',
  CHAIN_CHANGED: 'chainChanged',
  DISCONNECT: 'disconnect',
});

/**
 * Connector to connect an WalletConenct provider to Moralis
 * Note: this assumes using WalletConnect v1
 * TODO: support WalletConnect v2
 */
class WalletConnectWeb3Connector extends AbstractWeb3Connector {
  type = 'WalletConnect';
  network = 'evm';

  async activate({ chainId: providedChainId, mobileLinks } = {}) {
    if (!this.provider) {
      let WalletConnectProvider;

      try {
        WalletConnectProvider = require('@walletconnect/web3-provider');
      } catch (error) {
        // Do nothing. User might not need walletconnect
      }

      if (!WalletConnectProvider) {
        throw new Error(
          'Cannot enable WalletConnect: dependency "@walletconnect/web3-provider" is missing'
        );
      }

      if (typeof WalletConnectProvider.default === 'function') {
        this.provider = new WalletConnectProvider.default({
          rpc: getMoralisRpcs('WalletConnect'),
          chainId: providedChainId,
          qrcodeModalOptions: {
            mobileLinks,
          },
        });
      } else {
        this.provider = new window.WalletConnectProvider.default({
          rpc: getMoralisRpcs('WalletConnect'),
          chainId: providedChainId,
          qrcodeModalOptions: {
            mobileLinks,
          },
        });
      }
    }

    if (!this.provider) {
      throw new Error('Could not connect with WalletConnect, error in connecting to provider');
    }

    this.provider.on(WalletConnectEvent.CHAIN_CHANGED, this.handleChainChanged);
    this.provider.on(WalletConnectEvent.ACCOUNTS_CHANGED, this.handleAccountsChanged);
    // this.provider.on(WalletConnectEvent.DISCONNECT, this.handleDisconnect);

    const accounts = await this.provider.enable();
    const account = accounts[0].toLowerCase();
    const { chainId } = this.provider;
    const verifiedChainId = verifyChainId(chainId);

    this.account = account;
    this.chainId = verifiedChainId;

    return { provider: this.provider, account, chainId: verifiedChainId };
  }

  handleAccountsChanged(accounts) {
    const account = accounts ? accounts[0].toLowerCase() : null;
    this.account = account;
    this.emit(ConnectorEvent.ACCOUNT_CHANGED, account);
  }

  handleChainChanged(chainId) {
    const newChainId = verifyChainId(chainId);
    this.chainId = newChainId;
    this.emit(ConnectorEvent.CHAIN_CHANGED, newChainId);
  }

  static cleanupStaleData() {
    if (window) {
      try {
        window.localStorage.removeItem('walletconnect');
      } catch (error) {
        // Do nothing, might happen in react-native environment
      }
    }
  }

  async deactivate() {
    if (this.provider) {
      this.provider.close();
      this.provider.removeListener(WalletConnectEvent.CHAIN_CHANGED, this.handleChainChanged);
      this.provider.removeListener(WalletConnectEvent.ACCOUNTS_CHANGED, this.handleAccountsChanged);
    }

    WalletConnectWeb3Connector.cleanupStaleData();
  }

  async getProvider() {
    return this.provider;
  }

  async getChainId() {
    return this.provider.request({ method: 'eth_chainId' });
  }

  async getAccount() {
    const accounts = await this.provider.request({ method: 'eth_accounts' });
    return accounts[0];
  }
}

export default WalletConnectWeb3Connector;
