/**
 * saga-duck TS3.0+
 * @author cluezhang
 */
import { combineReducers } from "redux";
export type COMBINE_REDUCERS<T extends { [key: string]: () => any }> = (
  state: STATE_OF_REDUCERS<T>,
  action
) => STATE_OF_REDUCERS<T>;
type STATE_OF_REDUCERS<REDUCERS extends { [key: string]: () => any }> = {
  [key in keyof REDUCERS]: ReturnType<REDUCERS[key]>
};
type GLOBAL_SELECTOR<T> = T extends (state: any, ...rest: infer U) => infer K
  ? (globalState: any, ...rest: U) => K
  : never;
type GLOBAL_SELECTORS<T> = { [key in keyof T]: GLOBAL_SELECTOR<T[key]> };
export interface DuckOptions {
  namespace: string;
  selector(globalState: any): any;
  route: string;
}
const defaultDuckOptions: DuckOptions = {
  namespace: "global",
  selector(a) {
    return a;
  },
  route: ""
};
export type TYPES<T> = { readonly [P in keyof T]: string };
let idSeed = 1;
function generateId(prefix = "SAGA-DUCK") {
  return `${prefix}-${idSeed++}`;
}

export default class Duck {
  protected id: string = generateId();

  constructor(protected options: DuckOptions = defaultDuckOptions) {
    this._makeCacheGetters();
  }
  /** 内部属性，ActionType前缀 Internal property, prefix of action type. */
  protected get actionTypePrefix(): string {
    const { namespace, route } = this.options;
    return route ? `${namespace}/${route}/` : `${namespace}/`;
  }
  // 哪些属性需要缓存
  protected get _cacheGetters() {
    return ["types", "reducers", "selectors", "creators"];
  }
  // 生成缓存getter
  private _makeCacheGetters() {
    const me = this;
    for (const property of this._cacheGetters) {
      let descriptor = null;
      let target = this;
      // 从原型链中查找descriptor
      while (!descriptor) {
        target = Object.getPrototypeOf(target);
        if (!target) {
          break;
        }
        descriptor = Object.getOwnPropertyDescriptor(target, property);
      }
      if (!descriptor) {
        continue;
      }
      let cache;
      Object.defineProperty(this, property, {
        get() {
          if (!cache) {
            cache = descriptor.get.call(me);
          }
          return cache;
        }
      });
    }
  }
  // ------------------------ types --------------------
  /**
   * **不允许扩展**，请使用`quickTypes`或`rawTypes`定义
   * 
   * 获取当前Duck的actionTypes
   * 
   * **Disallow override**, please use `quickTypes` or `rawTypes` to define
   * 
   * Get actionTypes
   * @example
   * ```
*sagaFoo(){
    const { types } = this
    yield take(types.FOO)
}```
   */
  get types(): TYPES<this["quickTypes"]> & this["rawTypes"] {
    return Object.assign(
      {},
      this.makeTypes(this.quickTypes) as TYPES<this["quickTypes"]>,
      this.rawTypes
    );
  }
  /**
   * 快速声明Duck的action types，根据属性名自动添加namespace及route前缀生成action type，
   * 避免不同duck实例的冲突。
   * 
   * Quick declare action types, will auto generate type value with `namespace`, `route` and property key,
   * avoid conflict with different duck instance.
   * @example```
get quickTypes(){
    enum Types{
        FOO
    }
    return {
        ...super.quickTypes,
        ...Types,
        // 值无所谓，只根据键值“BAR”生成
        // no care of value, just generate from property key "BAR"
        BAR: 1
    }
}```
   */
  get quickTypes() {
    return {};
  }
  /**
   * 声明Duck的action types，与`quickTypes`不同的是，它不做任何处理，直接合并到`types`中，
   * 需自行避免冲突。
   * 
   * Declare action types of Duck, without any process, directly merge to types.
   * @example```
get rawTypes(){
    return {
        ...super.rawTypes,
        // 注意最终actionType就是“FOO”，所有实例共享
        // beware the finally value is "FOO", all Duck instances are same
        FOO: 'FOO'
    }
}
```
   */
  get rawTypes() {
    return {};
  }
  /**
   * 生成types工具方法，快速从enum转换
   * @example```
get types(){
  enum Types{FOO}
  return {
    ...super.types,
    ...this.makeTypes(Types)
  }
}```
     * @param typeEnum 
     */
  protected makeTypes<T>(typeEnum: T): TYPES<T> {
    const prefix = this.actionTypePrefix;
    let typeList: string[] = Object.keys(typeEnum);
    const types = {} as TYPES<T>;
    if (typeEnum) {
      typeList = typeList.concat(Object.keys(typeEnum));
    }
    typeList.forEach(type => {
      types[type as string] = prefix + type;
    });
    return types;
  }

  // ----------------------- reducers -----------------------
  /**
   * 定义reducers，Duck的state类型也从它自动生成
   * 
   * Define reducers, Duck's state type will auto generate from it.
   * @example```
get reducers(){
    const { types } = this
    return {
        ...super.reducers,
        foo(state = "", action): string {
            switch (action.type) {
            case types.FOO:
                return action.payload;
            }
            return state;
        }
    }
}
   ```
   */
  get reducers() {
    return {};
  }
  /** 内部属性，仅供父Duck或Redux store使用 Interal property, only use for parent Duck or Redux store.*/
  get reducer(): COMBINE_REDUCERS<this['reducers']> {
    return combineReducers(this.reducers);
  }
  /** 
   * 仅用于TS中获取State类型
   * 
   * Only use for get state type in Typescript.
   * @example
*sagaFoo(){
    type State = this['State']
    const state: State = xxx
}
   */
  get State(): ReturnType<this["reducer"]> {
    return null;
  }
  // ----------------------- selector/selectors ---------------------
  /** 
   * **不允许扩展**
   * 
   * 获取从全局redux state获取当前duck本地state的selector
   * 
   * **Disallow override**
   * 
   * Get selector for pick duck's state from global state.
   * @example```
*sagaFoo(){
    const { selector } = this
    const state = selector(yield select())
}
   ```
   */
  get selector(): (globalState: any) => this["State"] {
    return this.options.selector;
  }
  /** 
   * **不允许扩展**，请使用`rawSelectors`定义
   * 
   * 获取当前duck对应的selectors，以redux全局store作为第一个入参
   * 
   * **Disallow override**, please use `rawSelector` to define
   * 
   * Get current duck's selectors, use redux global store as first parameter.
   * @example```
*sagaFoo(){
    const { selectors } = this
    const foo = selectors.foo(yield select())
}
   ```
   */
  get selectors(): GLOBAL_SELECTORS<this["rawSelectors"]> {
    const { selector, rawSelectors } = this;
    const selectors = {} as GLOBAL_SELECTORS<this["rawSelectors"]>;
    for (const key of Object.keys(rawSelectors)) {
      selectors[key] = (globalState, ...rest) =>
        rawSelectors[key](selector(globalState), ...rest);
    }
    return selectors;
  }
  /** 
   * 定义Duck内部selectors，以duck本地state为第一入参
   * 
   * Define selectors, use duck's state as first parameter
   * @example```
get rawSelectors(){
    type State = this["State"];
    return {
        ...super.rawSelectors,
        foo(state: State, a: number) {
            return state.foo;
        }
    }
}
   ```
   */
  get rawSelectors() {
    return {};
  }
  /** 历史兼容  */
  get localSelectors(): this["rawSelectors"] {
    return this.rawSelectors;
  }
  // ---------------------- creators ------------------
  /** 
   * 定义actionCreators 
   * 
   * define actionCreators
   * @example```
get creators() {
    const { types } = this
    return {
        ...super.creators,
        foo(v: string) {
            return {
                type: types.FOO,
                payload: v
            }
        },
        bar: createToPayload<string>(types.BAR)
    };
}
   ```
   */
  get creators() {
    return {};
  }

  // ----------------------- saga ---------------------
  /**
   * saga主逻辑入口，请注意使用 `yield* super.saga()` 来继承
   * 
   * redux-saga entry, please use `yield* super.saga()` while override.
   * @example```
*saga() {
    yield* super.saga()
    const { types } = this
    yield take(types.FOO)
    yield* this.sagaFoo()
}
   * ```
   */
  *saga() {}
  /** 历史兼容 */
  get sagas() {
    return [this.saga.bind(this)];
  }
  /**
   * Memorize function result, for React Performance optimize
   * **MENTION** Should ONLY used to cache data associate with duck and dispatch, and duck MUST be stateless.
   *
   * 缓存与duck及dispatch关联的数据生成，使得每次输出都是一致的，方便React性能优化。
   * **注意** 仅能用于只和duck与dispatch有关的数据生成，并且duck必须是无状态的（即不可变的）
   *
   * @param {*} fn (duck, dispatch, {refs}) => any
   * @return {Function} memorizedFn (duckComponent | props) => cache
   */
  static memorize<T>(
    fn: (duck: any, dispatch: any) => T
  ): (reactInstanceOrProps: any) => T {
    const cacheKey = "_sagaDuckMemorized";
    const idKey = "_sagaDuckUniqId";
    const fnId = fn[idKey] || (fn[idKey] = generateId("MEMORIZE-FN"));
    return function memorizedFn(duckComponent) {
      let cacheHost;
      let props;
      if (duckComponent.isReactComponent && duckComponent.props) {
        props = duckComponent.props;
      } else {
        props = duckComponent;
        duckComponent = null;
      }
      const { duck, dispatch } = props;
      cacheHost = duckComponent || duck;

      const cache = cacheHost[cacheKey] || (cacheHost[cacheKey] = {});
      if (!dispatch[idKey]) {
        dispatch[idKey] = generateId("DISPATCH");
      }
      const key = duck.id + ":" + dispatch[idKey] + ":" + fnId;
      if (!(key in cache)) {
        cache[key] = fn(duck, dispatch);
      }
      return cache[key];
    };
  }
}

export const memorize = Duck.memorize;
