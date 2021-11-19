import web3Utils from 'web3-utils';
import EventEmitter from 'events';
import { ConnectorEvents, Web3Events } from './Web3Connector/events';

/**
 * A small web3 implementation that implements basic EIP-1193 `request` calls.
 * Can be created with provider from any of our Web3Connectors,
 * or custom implementation as long as the provider is EIP-1193 and implements the `request` call
 */
class MiniWeb3 extends EventEmitter {
  /**
   * @param {*} provider a EIP-1193 provider
   * @param {*} connector the connector that enabled this web3 (extended from AbstractWeb3Connector)
   */
  constructor(connector) {
    super();
    this.connector = connector;

    this.handleAccountChanged = this.handleAccountChanged.bind(this);
    this.handleChainChanged = this.handleChainChanged.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
  }

  async activate(options) {
    const { provider, chainId, account } = await this.connector.activate(options);

    this.provider = provider;
    this.chainId = chainId;
    this.account = account;

    if (this.connector.on) {
      this.connector.on(ConnectorEvents.ACCOUNT_CHANGED, this.handleAccountChanged);
      this.connector.on(ConnectorEvents.CHAIN_CHANGED, this.handleChainChanged);
      this.connector.on(ConnectorEvents.CONNECT, this.handleConnect);
      this.connector.on(ConnectorEvents.DISCONNECT, this.handleDisconnect);
    }

    return { provider, chainId, account };
  }

  handleChainChanged(chainId) {
    this.chainId = chainId;
    this.emit(Web3Events.CHAIN_CHANGED, chainId);
  }

  handleAccountChanged(account) {
    this.account = account;
    this.emit(Web3Events.ACCOUNT_CHANGED, account);
  }

  // Handle Connect events fired from connectors
  handleConnect(connectInfo) {
    this.emit(Web3Events.CONNECT, connectInfo);
  }

  // Handle Disconnect events fired from connectors
  handleDisconnect(error) {
    this.emit(Web3Events.DISCONNECT, error);
  }

  async deactivate() {
    this.account = null;
    this.chianId = null;

    if (this.connector) {
      if (this.connector.removeListener) {
        this.connector.removeListener(Web3Events.CHAIN_CHANGED, this.handleChainChanged);
        this.connector.removeListener(Web3Events.ACCOUNT_CHANGED, this.handleAccountChanged);
        this.connector.removeListener(Web3Events.CONNECT, this.handleConnect);
        this.connector.removeListener(Web3Events.DISCONNECT, this.handleDisconnect);
      }

      if (this.connector.deactivate) {
        await this.connector.deactivate();
      }
    }
  }

  async sendTransaction(data) {
    const from = data.account ?? this.account;
    const params = {
      ...data,
      from,
      value: data.value ? web3Utils.toHex(data.value) : undefined,
    };
    const method = 'eth_sendTransaction';

    return this.provider.request({ method, params: [params] });
  }

  personalSign({ message, account }) {
    const fromAccount = account ?? this.account;
    const params = [fromAccount, message];
    const method = 'personal_sign';

    return this.provider.request({ method, params });
  }

  signTypedDataV4({ params, from }) {
    const method = 'eth_signTypedData_v4';

    return this.provider.request({
      method,
      params,
    });
  }
}

export default MiniWeb3;
