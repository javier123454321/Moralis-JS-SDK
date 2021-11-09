/* global window */
import CoreManager from '../CoreManager';
import AbstractWeb3Connector from './AbstractWeb3Connector';
import { getMoralisRpcs } from './MoralisRpcs';

// TODO: use WalletConnect v2?
class WalletConnectWeb3Connector extends AbstractWeb3Connector {
  get type() {
    return 'WalletConnect';
  }

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

    const accounts = await this.provider.enable();
    const account = accounts[0];
    const { chainId } = this.provider;

    return { provider: this.provider, account, chainId };
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
      try {
        await this.provider.close();
      } catch {
        // Do nothing, might throw error if connection was not opened
      }
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
