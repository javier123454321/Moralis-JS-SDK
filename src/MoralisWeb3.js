import ParseObject from './ParseObject';
import ParseQuery from './ParseQuery';
import ParseUser from './ParseUser';
import ParseACL from './ParseACL';
import MoralisErd from './MoralisErd';
import MoralisDot from './MoralisDot';
import TransferUtils from './TransferUtils';
import { run } from './Cloud';
import createSigningData from './createSigningData';
import web3Utils from 'web3-utils';
import Contract from 'web3-eth-contract';

import WalletConnectWeb3Connector from './Web3Connector/WalletConnectWeb3Connector';
import InjectedWeb3Connector from './Web3Connector/InjectedWeb3Connector';
import NetworkWeb3Connector from './Web3Connector/NetworkWeb3Connector';
import ParseError from './ParseError';
import { Web3Events } from './Web3Connector/events';
import MiniWeb3 from './MiniWeb3';
import EventEmitter from 'events';

const WARNING = 'Non ethereum enabled browser';
const ERROR_WEB3_MISSING =
  'Missing web3 instance, make sure to call Moralis.enableWeb3() or Moralis.authenticate()';

function uniq(arr) {
  return arr.filter((v, i) => arr.indexOf(v) === i);
}

const MoralisEmitter = new EventEmitter();

class MoralisWeb3 {
  static speedyNodeApiKey;
  static web3 = null;
  static miniWeb3 = null;
  static customEnableWeb3;
  static Plugins = {};

  static addListener(eventName, listener) {
    MoralisEmitter.on(eventName, listener);
    return () => MoralisEmitter.removeListener(eventName, listener);
  }
  static on(eventName, listener) {
    MoralisEmitter.on(eventName, listener);
    return () => MoralisEmitter.removeListener(eventName, listener);
  }
  static once(eventName, listener) {
    MoralisEmitter.once(eventName, listener);
    return () => MoralisEmitter.removeListener(eventName, listener);
  }
  static removeListener(eventName, listener) {
    return MoralisEmitter.removeListener(eventName, listener);
  }
  static off(eventName, listener) {
    return MoralisEmitter.off(eventName, listener);
  }
  static removeAllListeners(eventName, listener) {
    return MoralisEmitter.removeAllListeners(eventName, listener);
  }

  static isWeb3Enabled() {
    return this.ensureWeb3IsInstalled();
  }

  static handleWeb3AccountChanged(account) {
    MoralisEmitter.emit(Web3Events.ACCOUNT_CHANGED, account);
  }

  static handleWeb3ChainChanged(chainId) {
    MoralisEmitter.emit(Web3Events.CHAIN_CHANGED, chainId);
  }

  static handleWeb3Connect(connectInfo) {
    MoralisEmitter.emit(Web3Events.CONNECT, connectInfo);
  }

  static handleWeb3Disconnect(error) {
    this.cleanup();
    MoralisEmitter.emit(Web3Events.DISCONNECT, error);
  }

  static async enableWeb3(options) {
    if (this.speedyNodeApiKey) {
      options.speedyNodeApiKey = this.speedyNodeApiKey;
      options.provider = 'network';
    }

    if (this.miniWeb3) {
      await this.cleanup();
    }

    const Connector = options.connector ?? MoralisWeb3.getWeb3Connector(options.provider);
    const connector = new Connector(options);

    this.miniWeb3 = new MiniWeb3(connector);

    this.miniWeb3.on(Web3Events.ACCOUNT_CHANGED, args => this.handleWeb3AccountChanged(args));
    this.miniWeb3.on(Web3Events.CHAIN_CHANGED, args => this.handleWeb3ChainChanged(args));
    this.miniWeb3.on(Web3Events.CONNECT, args => this.handleWeb3Connect(args));
    this.miniWeb3.on(Web3Events.DISCONNECT, args => this.handleWeb3Disconnect(args));

    let provider;
    let chainId;
    let account;

    try {
      ({ provider, chainId, account } = await this.miniWeb3.activate(options));

      if (!provider) {
        throw new Error('Failed to activate, no provider returned');
      }
    } catch (error) {
      await this.cleanup();
      throw error;
    }

    let web3 = null;

    if (this.web3Library) {
      web3 = new this.web3Library(provider);
    }

    this.web3 = web3;
    MoralisEmitter.emit(Web3Events.WEB3_ENABLED, {
      chainId,
      account,
      connector,
      provider,
      web3,
    });

    return web3;
  }

  static async enable(options) {
    // eslint-disable-next-line no-console
    console.warn(
      'Moralis.enable() is deprecated and will be removed, use Moralis.enableWeb3() instead.'
    );
    return this.enableWeb3(options);
  }

  static isDotAuth(options) {
    switch (options?.type) {
      case 'dot':
      case 'polkadot':
      case 'kusama':
        return true;
      default:
        return false;
    }
  }
  static isElrondAuth(options) {
    switch (options?.type) {
      case 'erd':
      case 'elrond':
        return true;
      default:
        return false;
    }
  }
  static getWeb3Connector(provider) {
    switch (provider) {
      case 'walletconnect':
      case 'walletConnect':
      case 'wc':
        return WalletConnectWeb3Connector;
      case 'network':
        return NetworkWeb3Connector;
      default:
        return InjectedWeb3Connector;
    }
  }

  static async deactivateWeb3() {
    return this.cleanup();
  }

  static async cleanup() {
    if (this.miniWeb3) {
      this.miniWeb3.removeListener(Web3Events.ACCOUNT_CHANGED, this.handleWeb3AccountChanged);
      this.miniWeb3.removeListener(Web3Events.CHAIN_CHANGED, this.handleWeb3ChainChanged);
      this.miniWeb3.removeListener(Web3Events.CONNECT, this.handleWeb3Connect);
      this.miniWeb3.removeListener(Web3Events.DISCONNECT, this.handleWeb3Disconnect);

      await this.miniWeb3.deactivate();
    }

    if (this.web3) {
      MoralisEmitter.emit(Web3Events.WEB3_DEACTIVATED, {
        connector: this.miniWeb3.connector,
        provider: this.miniWeb3.provider,
      });
    }

    this.miniWeb3 = null;
    this.web3 = null;

    // Prevent a bug when there is stale data active
    WalletConnectWeb3Connector.cleanupStaleData();
  }

  static async authenticate(options) {
    const isLoggedIn = await ParseUser.currentAsync();
    if (isLoggedIn) {
      await ParseUser.logOut();
    }

    await this.cleanup();

    if (MoralisWeb3.isDotAuth(options)) {
      return MoralisDot.authenticate(options);
    }

    if (MoralisWeb3.isElrondAuth(options)) {
      return MoralisErd.authenticate(options);
    }

    await this.enableWeb3(options);
    const miniWeb3 = this.getMiniWeb3();
    const { account } = miniWeb3;

    if (!account) {
      throw new Error('Cannot authenticate, no account returned from provider');
    }

    const message = options?.signingMessage || MoralisWeb3.getSigningData();
    const data = await createSigningData(message);
    const ethAddress = account.toLowerCase();
    if (!ethAddress) throw new Error('Address not found');

    const signature = await miniWeb3.personalSign({ message: data, account });
    if (!signature) throw new Error('Data not signed');
    const authData = { id: ethAddress, signature, data };
    const user = await ParseUser.logInWith('moralisEth', { authData });
    await user.setACL(new ParseACL(user));
    if (!user) throw new Error('Could not get user');
    user.set('accounts', uniq([].concat(ethAddress, user.get('accounts') ?? [])));
    user.set('ethAddress', ethAddress);
    await user.save(null, options);
    return user;
  }

  static async link(account, options) {
    const miniWeb3 = this.getMiniWeb3();
    const data = options?.signingMessage || MoralisWeb3.getSigningData();
    const user = await ParseUser.currentAsync();
    const ethAddress = account.toLowerCase();

    const EthAddress = ParseObject.extend('_EthAddress');
    const query = new ParseQuery(EthAddress);
    const ethAddressRecord = await query.get(ethAddress).catch(() => null);
    if (!ethAddressRecord) {
      const signature = await miniWeb3.personalSign({ message: data, account });

      if (!signature) throw new Error('Data not signed');
      const authData = { id: ethAddress, signature, data };
      await user.linkWith('moralisEth', { authData });
    }
    user.set('accounts', uniq([ethAddress].concat(user.get('accounts') ?? [])));
    user.set('ethAddress', ethAddress);
    await user.save(null, options);
    return user;
  }
  static async unlink(account) {
    const accountsLower = account.toLowerCase();
    const EthAddress = ParseObject.extend('_EthAddress');
    const query = new ParseQuery(EthAddress);
    const ethAddressRecord = await query.get(accountsLower);
    await ethAddressRecord.destroy();
    const user = await ParseUser.currentAsync();
    const accounts = user.get('accounts') ?? [];
    const nextAccounts = accounts.filter(v => v !== accountsLower);
    user.set('accounts', nextAccounts);
    user.set('ethAddress', nextAccounts[0]);
    await user._unlinkFrom('moralisEth');
    await user.save();
    return user;
  }

  static async initPlugins(installedPlugins) {
    const specs = installedPlugins || (await run('getPluginSpecs'));

    if (!this.Plugins) this.Plugins = {};
    if (!specs) return;

    const allPlugins = this.Plugins;
    specs.forEach(plugin => {
      allPlugins[plugin.name] = {};
      plugin.functions.forEach(f => {
        allPlugins[plugin.name][f] = async (params, options) => {
          if (!options) options = {};
          const response = await run(`${plugin.name}_${f}`, params);
          if (!response.data.success) {
            const error = JSON.stringify(response.data.data, null, 2);
            throw new Error(`Something went wrong\n${error}`);
          }
          if (options.disableTriggers !== true) {
            const triggerReturn = await this.handleTriggers(
              response.data.result.triggers,
              response.data.result.data
            );
            if (triggerReturn) return triggerReturn;
          }
          return response.data.result;
        };
      });
    });
    this.Plugins = allPlugins;
  }

  static async handleTriggers(triggersArray, payload) {
    if (!triggersArray) return;

    let response;
    for (let i = 0; i < triggersArray.length; i++) {
      switch (triggersArray[i]?.name) {
        // Handles `openUrl` trigger
        case 'openUrl':
          // Open url in a new tab
          if (
            triggersArray[i]?.options?.newTab === true ||
            !triggersArray[i]?.options?.hasOwnProperty('newTab')
          ) {
            // eslint-disable-next-line no-undef
            window.open(triggersArray[i]?.data);
          }

          // Open url in the same tab
          if (triggersArray[i]?.options?.newTab === false) {
            // eslint-disable-next-line no-undef
            window.open(triggersArray[i]?.data, '_self');
          }

          break;

        // Handles `web3Transaction` trigger
        case 'web3Transaction':
          // Trigger a web3 transaction (await)
          if (triggersArray[i]?.shouldAwait === true)
            response = await this.getMiniWeb3().sendTransaction(triggersArray[i]?.data);

          // Trigger a web3 transaction (does NOT await)
          if (triggersArray[i]?.shouldAwait === false)
            response = this.getMiniWeb3().sendTransaction(triggersArray[i]?.data);

          // Save the response returned by the web3 trasanction
          if (triggersArray[i]?.saveResponse === true) this.memoryCard.save(response);

          // Return payload and response
          if (triggersArray[i]?.shouldReturnPayload === true)
            return { payload: payload, response: response };

          // Only return response
          if (triggersArray[i]?.shouldReturnResponse === true) return response;
          break;

        // Handles `web3Sign` trigger
        case 'web3Sign':
          if (!triggersArray[i].message)
            throw new Error('web3Sign trigger does not have a message to sign');
          if (!triggersArray[i].signer || !web3Utils.isAddress(triggersArray[i].signer))
            throw new Error('web3Sign trigger signer address missing or invalid');

          // Sign a message using web3 (await)
          if (triggersArray[i]?.shouldAwait === true)
            response = await this.getMiniWeb3().personalSign({
              account: triggersArray[i].signer,
              message: triggersArray[i].message,
            });

          // Sign a message using web3 (does NOT await)
          if (triggersArray[i]?.shouldAwait === false)
            response = this.getMiniWeb3().personalSign({
              account: triggersArray[i].signer,
              message: triggersArray[i].message,
            });

          // Save response
          if (triggersArray[i]?.saveResponse === true) this.memoryCard.save(response);

          // Return payload and response
          if (triggersArray[i]?.shouldReturnPayload === true)
            return { payload: payload, response: response };

          // Only return response
          if (triggersArray[i]?.shouldReturnResponse === true) return response;
          break;

        // Calls a given plugin endpoint
        case 'callPluginEndpoint':
          if (!triggersArray[i].pluginName)
            throw new Error('callPluginEndpoint trigger does not have an plugin name to call');
          if (!triggersArray[i].endpoint)
            throw new Error('callPluginEndpoint trigger does not have an endpoint to call');

          // Call a plugin endpoint (await)
          if (triggersArray[i]?.shouldAwait === true) {
            // Check if a saved response has to be used to fill a parameter needed by the plugin
            if (triggersArray[i].useSavedResponse === true) {
              triggersArray[i].params[triggersArray[i].savedResponseAs] = this.memoryCard.get(
                triggersArray[i].savedResponseAt
              );
            }

            // Call the endpoint
            response = await run(
              `${triggersArray[i].pluginName}_${triggersArray[i].endpoint}`,
              triggersArray[i].params
            );
          }

          // Call a plugin endpoint (does NOT await)
          if (triggersArray[i]?.shouldAwait === false) {
            // Check if a saved response has to be used to fill a parameter needed by the plugin
            if (triggersArray[i].useSavedResponse === true) {
              triggersArray[i].params[triggersArray[i].savedResponseAs] = this.memoryCard.get(
                triggersArray[i].savedResponseAt
              );
            }

            // Call the endpoint
            response = run(
              `${triggersArray[i].pluginName}_${triggersArray[i].endpoint}`,
              triggersArray[i].params
            );
          }

          // If the response contains a trigger, run it
          if (triggersArray[i].runResponseTrigger === true) {
            response = await this.handleTriggers(
              response.data.result.triggers,
              response.data.result.data
            );
          }

          // Save response
          if (triggersArray[i]?.saveResponse === true) this.memoryCard.save(response);

          // If should not run the response trigger, continues the loop and does not return (to avoid breaking the loop execution and run other pending triggers)
          if (triggersArray[i]?.runResponseTrigger === false) continue;

          // Return payload and response
          if (triggersArray[i]?.shouldReturnPayload === true)
            return { payload: 'payload', response: response };

          // Only return response
          if (triggersArray[i]?.shouldReturnResponse === true) return response;
          break;

        case 'web3SignV4':
          if (!triggersArray[i].parameters)
            throw new Error('web3SignV4 trigger does not have `parameters` to sign');
          if (!triggersArray[i].from)
            throw new Error('web3SignV4 trigger does not have a `from` address');

          if (triggersArray[i]?.shouldAwait === true) {
            try {
              const result = await this.getMiniWeb3().signTypedDataV4({
                params: triggersArray[i].parameters,
                from: triggersArray[i].from,
              });

              if (triggersArray[i]?.saveResponse === true) this.memoryCard.save(result);
              response = result;
            } catch (error) {
              throw new Error(error.message || error);
            }
          }

          if (triggersArray[i]?.shouldAwait === false) {
            this.getMiniWeb3()
              .signTypedDataV4({
                params: triggersArray[i].parameters,
                from: triggersArray[i].from,
              })
              // eslint-disable-next-line no-loop-func
              .then(result => {
                if (triggersArray[i]?.saveResponse === true) this.memoryCard.save(result);
                response = result;
              })
              .catch(error => {
                throw new Error(error.message || error);
              });
          }

          // Return payload and response
          if (triggersArray[i]?.shouldReturnPayload === true)
            return { payload: payload, response: response };

          // Only return response
          if (triggersArray[i]?.shouldReturnResponse === true) return response;
          break;
        default:
          throw new Error(`Unknown trigger: "${triggersArray[i]?.name}"`);
      }
    }

    // Delete all saved data
    this.memoryCard.deleteSaved();
  }

  static async getAllERC20({ chain, address } = {}) {
    const result = await run('getAllERC20', { chain, address });

    return result;
  }

  static async getERC20({ chain, address, symbol, tokenAddress } = {}) {
    const result = run('getERC20', { chain, address, symbol, tokenAddress });

    return result;
  }

  static getNFTs({ chain = 'Eth', address = '' } = {}) {
    return run('getNFTs_old', { chain, address });
  }

  static getNFTsCount({ chain = 'Eth', address = '' } = {}) {
    return run('getNFTsCount_old', { chain, address });
  }

  static getTransactions({ chain = 'Eth', address = '', order = 'desc' } = {}) {
    return run('getTransactions', { chain, address, order });
  }

  static getTransactionsCount({ chain = 'Eth', address = '' } = {}) {
    return run('getTransactionsCount', { chain, address });
  }

  static async transfer({
    type = 'native',
    receiver = '',
    contractAddress = '',
    // eslint-disable-next-line camelcase
    contract_address,
    amount = '',
    tokenId = '',
    // eslint-disable-next-line camelcase
    token_id,
    system = 'evm',
    awaitReceipt = true,
  } = {}) {
    // Allow snake-case for backwards compatibility
    // eslint-disable-next-line camelcase
    contractAddress = contractAddress || contract_address;
    // eslint-disable-next-line camelcase
    tokenId = tokenId || token_id;

    const options = {
      receiver,
      contractAddress,
      amount,
      tokenId,
      system,
      awaitReceipt,
    };

    TransferUtils.isSupportedType(type);
    TransferUtils.validateInput(type, options);

    const miniWeb3 = this.getMiniWeb3();
    const sender = miniWeb3.account;

    if (!sender) throw new Error('Sender address not found');

    let transferOperation;
    let customToken;

    if (tokenId) TransferUtils.isUint256(tokenId);

    if (type !== 'native') {
      customToken = new Contract(TransferUtils.abi[type], contractAddress);
      customToken.setProvider(miniWeb3.provider);
    }
    switch (type) {
      case 'native':
        transferOperation = miniWeb3.sendTransaction({
          from: sender,
          to: receiver,
          value: amount,
        });
        break;
      case 'erc20':
        transferOperation = customToken.methods.transfer(receiver, amount).send({
          from: sender,
        });
        break;
      case 'erc721':
        transferOperation = customToken.methods
          .safeTransferFrom(sender, receiver, `${tokenId}`)
          .send({
            from: sender,
          });
        break;
      case 'erc1155':
        transferOperation = customToken.methods
          .safeTransferFrom(sender, receiver, `${tokenId}`, amount, '0x')
          .send({
            from: sender,
          });
        break;
      default:
        throw new Error(`Unknown transfer type: "${type}"`);
    }

    if (awaitReceipt) return transferOperation;

    const transferEvents = new EventEmitter();

    transferOperation
      .on('transactionHash', hash => {
        transferEvents.emit('transactionHash', hash);
      })
      .on('receipt', receipt => {
        transferEvents.emit('receipt', receipt);
      })
      .on('confirmation', (confirmationNumber, receipt) => {
        transferEvents.emit('confirmation', (confirmationNumber, receipt));
      })
      .on('error', error => {
        transferEvents.emit('error', error);
        throw error;
      });

    return transferEvents;
  }

  static async executeFunction({
    contractAddress,
    abi,
    functionName,
    msgValue,
    awaitReceipt = true,
    params = {},
  } = {}) {
    const contractOptions = {};

    const miniWeb3 = this.getMiniWeb3();

    const functionData = abi.find(x => x.name === functionName);

    if (!functionData) throw new Error('Function does not exist in abi');

    const stateMutability = functionData?.stateMutability;

    const isReadFunction = stateMutability === 'view' || stateMutability === 'pure';

    if (!isReadFunction) {
      if (!params.from) {
        const currentAddress = miniWeb3.account;
        if (!currentAddress) throw new Error('From address is required');
        contractOptions.from = currentAddress;
      }
    }

    const errors = [];

    for (const input of functionData.inputs) {
      const value = params[input.name];
      if (!(typeof value !== 'undefined' && value)) {
        errors.push(`${input.name} is required`);
      }
    }

    if (errors.length > 0) {
      throw errors;
    }

    const parsedInputs = functionData.inputs.map(x => {
      return params[x.name];
    });

    const contract = new Contract(abi, contractAddress, contractOptions);
    contract.setProvider(miniWeb3.provider);

    const customFunction = contract.methods[functionName];

    const response = isReadFunction
      ? customFunction(...Object.values(parsedInputs)).call()
      : customFunction(...Object.values(parsedInputs)).send(msgValue ? { value: msgValue } : null);

    if (awaitReceipt) return response;

    const contractExecuteEvents = new EventEmitter();

    response
      .on('transactionHash', hash => {
        contractExecuteEvents.emit('transactionHash', hash);
      })
      .on('receipt', receipt => {
        contractExecuteEvents.emit('receipt', receipt);
      })
      .on('confirmation', (confirmationNumber, receipt) => {
        contractExecuteEvents.emit('confirmation', (confirmationNumber, receipt));
      })
      .on('error', error => {
        contractExecuteEvents.emit('error', error);
        throw error;
      });

    return contractExecuteEvents;
  }

  static getSigningData() {
    return `Moralis Authentication`;
  }

  static ensureWeb3IsInstalled() {
    return this.miniWeb3 ? true : false;
  }

  /**
   * Gets the miniWeb3 with validation to make sure it has been instansiated with 'enableWeb3()'
   */
  static getMiniWeb3() {
    if (!this.ensureWeb3IsInstalled()) throw new Error(ERROR_WEB3_MISSING);

    return this.miniWeb3;
  }

  static get provider() {
    return this.miniWeb3?.provider ?? null;
  }

  static get connector() {
    return this.miniWeb3?.connector ?? null;
  }

  static get connectorType() {
    return this.connector?.type ?? null;
  }

  static get network() {
    return this.connector?.network ?? null;
  }

  static get account() {
    return this.miniWeb3?.account ?? null;
  }

  static get chainId() {
    return this.miniWeb3?.chainId ?? null;
  }

  static getChainId() {
    return this.chainId;
  }

  static _forwardToConnector(methodName, args) {
    const miniWeb3 = this.getMiniWeb3();
    const { connector } = miniWeb3;

    const hasMethod = Boolean(connector[methodName]);

    if (!hasMethod) {
      throw new Error(
        `Cannot call ${methodName}, as it does not exist on connector type "${connector.type}"`
      );
    }

    return connector[methodName](...args);
  }

  static switchNetwork(...args) {
    return this._forwardToConnector('switchNetwork', args);
  }

  static addNetwork(...args) {
    return this._forwardToConnector('addNetwork', args);
  }

  static memoryCard = {
    save(what) {
      this.saved = what;
    },

    get(where) {
      if (!this.saved) throw new Error('Nothing saved to memory card');

      // In case the saved data is not an object but a simple string or number
      if (where.length === 0) return this.getSaved();

      let tmp;
      let savedTmp = this.saved;
      for (let i = 0; i < where.length; i++) {
        tmp = savedTmp[where[i]];
        savedTmp = tmp;
      }

      return savedTmp;
    },

    getSaved() {
      return this.saved;
    },

    deleteSaved() {
      this.saved = undefined;
    },
  };
}

MoralisWeb3.onConnect = MoralisWeb3.on.bind(MoralisWeb3, Web3Events.CONNECT);
MoralisWeb3.onDisconnect = MoralisWeb3.on.bind(MoralisWeb3, Web3Events.DISCONNECT);
MoralisWeb3.onWeb3Enabled = MoralisWeb3.on.bind(MoralisWeb3, Web3Events.WEB3_ENABLED);
MoralisWeb3.onWeb3Deactivated = MoralisWeb3.on.bind(MoralisWeb3, Web3Events.WEB3_DEACTIVATED);
MoralisWeb3.onChainChanged = MoralisWeb3.on.bind(MoralisWeb3, Web3Events.CHAIN_CHANGED);
MoralisWeb3.onAccountChanged = MoralisWeb3.on.bind(MoralisWeb3, Web3Events.ACCOUNT_CHANGED);

export default MoralisWeb3;
