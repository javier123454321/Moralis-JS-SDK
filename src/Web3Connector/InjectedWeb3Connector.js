/* global window */

import AbstractWeb3Connector from './AbstractWeb3Connector';
import EventEmitter from 'events';
import { ConnectorEvent } from './events';
import verifyChainId from '../utils/verifyChainId';

class NoEthereumProviderError extends Error {
  constructor() {
    super();
    this.message = 'Non ethereum enabled browser';
  }
}

/**
 * Connector to connect an injected provider (like Metamask) to Moralis
 * The provider should be injected in window.ethereum
 */
class InjectedWeb3Connector extends AbstractWeb3Connector {
  type = 'injected';
  network = 'evm';

  constructor() {
    super();
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
    this.handleChainChanged = this.handleChainChanged.bind(this);
  }

  verifyEthereumBrowser() {
    if (!window?.ethereum) {
      throw new NoEthereumProviderError();
    }
  }

  async activate() {
    this.verifyEthereumBrowser();

    const [accounts, chainId] = await Promise.all([
      window.ethereum.request({
        method: 'eth_requestAccounts',
      }),
      window.ethereum.request({ method: 'eth_chainId' }),
    ]);
    const account = accounts[0] ? accounts[0].toLowerCase() : null;

    this.chainId = chainId;
    this.account = account;

    const provider = window.ethereum;

    if (window.ethereum.on) {
      window.ethereum.on('chainChanged', this.handleChainChanged);
      window.ethereum.on('accountsChanged', this.handleAccountsChanged);
    }

    return { provider, chainId, account };
  }

  handleAccountsChanged(accounts) {
    const account = accounts ? accounts[0].toLowerCase() : null;
    this.account = account;
    this.emit(ConnectorEvent.ACCOUNT_CHANGED, account);
  }

  handleChainChanged(chainId) {
    this.chainId = chainId;
    this.emit(ConnectorEvent.CHAIN_CHANGED, chainId);
  }

  deactivate() {
    if (window.ethereum && window.ethereum.removeListener) {
      window.ethereum.removeListener('chainChanged', this.handleChainChanged);
      window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
    }
  }

  async switchNetwork(chainId) {
    this.verifyEthereumBrowser();
    chainId = verifyChainId(chainId);
    // Check if the user wallet is already on `chainId`
    const currentNetwork = this.chainId;
    if (currentNetwork === chainId) return;
    // Trigger network switch
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  }

  static async addNetwork(
    chainId,
    chainName,
    currencyName,
    currencySymbol,
    rpcUrl,
    blockExplorerUrl
  ) {
    this.verifyEthereumBrowser();
    chainId = verifyChainId(chainId);
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainId,
          chainName: chainName,
          nativeCurrency: {
            name: currencyName,
            symbol: currencySymbol,
            decimals: 18,
          },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [blockExplorerUrl],
        },
      ],
    });
  }
}

export default InjectedWeb3Connector;
