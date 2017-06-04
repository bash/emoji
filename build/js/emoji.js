(function () {
'use strict';

function VNode() {}

var options = {};

const stack = [];

const EMPTY_CHILDREN = [];

function h(nodeName, attributes) {
	let children = EMPTY_CHILDREN,
	    lastSimple,
	    child,
	    simple,
	    i;
	for (i = arguments.length; i-- > 2;) {
		stack.push(arguments[i]);
	}
	if (attributes && attributes.children != null) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		if ((child = stack.pop()) && child.pop !== undefined) {
			for (i = child.length; i--;) stack.push(child[i]);
		} else {
			if (child === true || child === false) child = null;

			if (simple = typeof nodeName !== 'function') {
				if (child == null) child = '';else if (typeof child === 'number') child = String(child);else if (typeof child !== 'string') simple = false;
			}

			if (simple && lastSimple) {
				children[children.length - 1] += child;
			} else if (children === EMPTY_CHILDREN) {
				children = [child];
			} else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}

	let p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes == null ? undefined : attributes;
	p.key = attributes == null ? undefined : attributes.key;

	if (options.vnode !== undefined) options.vnode(p);

	return p;
}

function extend(obj, props) {
  for (let i in props) obj[i] = props[i];
  return obj;
}

const NO_RENDER = 0;
const SYNC_RENDER = 1;
const FORCE_RENDER = 2;
const ASYNC_RENDER = 3;

const ATTR_KEY = '__preactattr_';

const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

let items = [];

function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
		(options.debounceRendering || setTimeout)(rerender);
	}
}

function rerender() {
	let p,
	    list = items;
	items = [];
	while (p = list.pop()) {
		if (p._dirty) renderComponent(p);
	}
}

function isSameNodeType(node, vnode, hydrating) {
	if (typeof vnode === 'string' || typeof vnode === 'number') {
		return node.splitText !== undefined;
	}
	if (typeof vnode.nodeName === 'string') {
		return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
	}
	return hydrating || node._componentConstructor === vnode.nodeName;
}

function isNamedNode(node, nodeName) {
	return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
}

function getNodeProps(vnode) {
	let props = extend({}, vnode.attributes);
	props.children = vnode.children;

	let defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps !== undefined) {
		for (let i in defaultProps) {
			if (props[i] === undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

function createNode(nodeName, isSvg) {
	let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}

function removeNode(node) {
	if (node.parentNode) node.parentNode.removeChild(node);
}

function setAccessor(node, name, old, value, isSvg) {
	if (name === 'className') name = 'class';

	if (name === 'key') {} else if (name === 'ref') {
		if (old) old(null);
		if (value) value(node);
	} else if (name === 'class' && !isSvg) {
		node.className = value || '';
	} else if (name === 'style') {
		if (!value || typeof value === 'string' || typeof old === 'string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value === 'object') {
			if (typeof old !== 'string') {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
			}
		}
	} else if (name === 'dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	} else if (name[0] == 'o' && name[1] == 'n') {
		let useCapture = name !== (name = name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!old) node.addEventListener(name, eventProxy, useCapture);
		} else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
		setProperty(node, name, value == null ? '' : value);
		if (value == null || value === false) node.removeAttribute(name);
	} else {
		let ns = isSvg && name !== (name = name.replace(/^xlink\:?/, ''));
		if (value == null || value === false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
		} else if (typeof value !== 'function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
		}
	}
}

function setProperty(node, name, value) {
	try {
		node[name] = value;
	} catch (e) {}
}

function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}

const mounts = [];

let diffLevel = 0;

let isSvgMode = false;

let hydrating = false;

function flushMounts() {
	let c;
	while (c = mounts.pop()) {
		if (options.afterMount) options.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}

function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	if (!diffLevel++) {
		isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

		hydrating = dom != null && !(ATTR_KEY in dom);
	}

	let ret = idiff(dom, vnode, context, mountAll, componentRoot);

	if (parent && ret.parentNode !== parent) parent.appendChild(ret);

	if (! --diffLevel) {
		hydrating = false;

		if (!componentRoot) flushMounts();
	}

	return ret;
}

function idiff(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
	    prevSvgMode = isSvgMode;

	if (vnode == null) vnode = '';

	if (typeof vnode === 'string') {
		if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
			if (dom.nodeValue != vnode) {
				dom.nodeValue = vnode;
			}
		} else {
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				recollectNodeTree(dom, true);
			}
		}

		out[ATTR_KEY] = true;

		return out;
	}

	if (typeof vnode.nodeName === 'function') {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}

	isSvgMode = vnode.nodeName === 'svg' ? true : vnode.nodeName === 'foreignObject' ? false : isSvgMode;

	if (!dom || !isNamedNode(dom, String(vnode.nodeName))) {
		out = createNode(String(vnode.nodeName), isSvgMode);

		if (dom) {
			while (dom.firstChild) out.appendChild(dom.firstChild);

			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			recollectNodeTree(dom, true);
		}
	}

	let fc = out.firstChild,
	    props = out[ATTR_KEY] || (out[ATTR_KEY] = {}),
	    vchildren = vnode.children;

	if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
		if (fc.nodeValue != vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	} else if (vchildren && vchildren.length || fc != null) {
			innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
		}

	diffAttributes(out, vnode.attributes, props);

	isSvgMode = prevSvgMode;

	return out;
}

function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
	    children = [],
	    keyed = {},
	    keyedLen = 0,
	    min = 0,
	    len = originalChildren.length,
	    childrenLen = 0,
	    vlen = vchildren ? vchildren.length : 0,
	    j,
	    c,
	    vchild,
	    child;

	if (len !== 0) {
		for (let i = 0; i < len; i++) {
			let child = originalChildren[i],
			    props = child[ATTR_KEY],
			    key = vlen && props ? child._component ? child._component.__key : props.key : null;
			if (key != null) {
				keyedLen++;
				keyed[key] = child;
			} else if (props || (child.splitText !== undefined ? isHydrating ? child.nodeValue.trim() : true : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen !== 0) {
		for (let i = 0; i < vlen; i++) {
			vchild = vchildren[i];
			child = null;

			let key = vchild.key;
			if (key != null) {
				if (keyedLen && keyed[key] !== undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			} else if (!child && min < childrenLen) {
					for (j = min; j < childrenLen; j++) {
						if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
							child = c;
							children[j] = undefined;
							if (j === childrenLen - 1) childrenLen--;
							if (j === min) min++;
							break;
						}
					}
				}

			child = idiff(child, vchild, context, mountAll);

			if (child && child !== dom) {
				if (i >= len) {
					dom.appendChild(child);
				} else if (child !== originalChildren[i]) {
					if (child === originalChildren[i + 1]) {
						removeNode(originalChildren[i]);
					} else {
						dom.insertBefore(child, originalChildren[i] || null);
					}
				}
			}
		}
	}

	if (keyedLen) {
		for (let i in keyed) if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
	}

	while (min <= childrenLen) {
		if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
	}
}

function recollectNodeTree(node, unmountOnly) {
	let component = node._component;
	if (component) {
		unmountComponent(component);
	} else {
		if (node[ATTR_KEY] != null && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);

		if (unmountOnly === false || node[ATTR_KEY] == null) {
			removeNode(node);
		}

		removeChildren(node);
	}
}

function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}

function diffAttributes(dom, attrs, old) {
	let name;

	for (name in old) {
		if (!(attrs && attrs[name] != null) && old[name] != null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	for (name in attrs) {
		if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}

const components = {};

function collectComponent(component) {
	let name = component.constructor.name;
	(components[name] || (components[name] = [])).push(component);
}

function createComponent(Ctor, props, context) {
	let list = components[Ctor.name],
	    inst;

	if (Ctor.prototype && Ctor.prototype.render) {
		inst = new Ctor(props, context);
		Component.call(inst, props, context);
	} else {
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}

	if (list) {
		for (let i = list.length; i--;) {
			if (list[i].constructor === Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}

function doRender(props, state, context) {
	return this.constructor(props, context);
}

function setComponentProps(component, props, opts, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	if (component.__ref = props.ref) delete props.ref;
	if (component.__key = props.key) delete props.key;

	if (!component.base || mountAll) {
		if (component.componentWillMount) component.componentWillMount();
	} else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context !== component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (opts !== NO_RENDER) {
		if (opts === SYNC_RENDER || options.syncComponentUpdates !== false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		} else {
			enqueueRender(component);
		}
	}

	if (component.__ref) component.__ref(component);
}

function renderComponent(component, opts, mountAll, isChild) {
	if (component._disable) return;

	let props = component.props,
	    state = component.state,
	    context = component.context,
	    previousProps = component.prevProps || props,
	    previousState = component.prevState || state,
	    previousContext = component.prevContext || context,
	    isUpdate = component.base,
	    nextBase = component.nextBase,
	    initialBase = isUpdate || nextBase,
	    initialChildComponent = component._component,
	    skip = false,
	    rendered,
	    inst,
	    cbase;

	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts !== FORCE_RENDER && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		} else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		let childComponent = rendered && rendered.nodeName,
		    toUnmount,
		    base;

		if (typeof childComponent === 'function') {

			let childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			} else {
				toUnmount = inst;

				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		} else {
			cbase = initialBase;

			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts === SYNC_RENDER) {
				if (cbase) cbase._component = null;
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base !== baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
			    t = component;
			while (t = t._parentComponent) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	} else if (!skip) {
		flushMounts();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	if (component._renderCallbacks != null) {
		while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);
	}

	if (!diffLevel && !isChild) flushMounts();
}

function buildComponentFromVNode(dom, vnode, context, mountAll) {
	let c = dom && dom._component,
	    originalComponent = c,
	    oldDom = dom,
	    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
	    isOwner = isDirectOwner,
	    props = getNodeProps(vnode);
	while (c && !isOwner && (c = c._parentComponent)) {
		isOwner = c.constructor === vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	} else {
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}

		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;

			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom !== oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}

function unmountComponent(component) {
	if (options.beforeUnmount) options.beforeUnmount(component);

	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	} else if (base) {
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

		component.nextBase = base;

		removeNode(base);
		collectComponent(component);

		removeChildren(base);
	}

	if (component.__ref) component.__ref(null);
}

function Component(props, context) {
	this._dirty = true;

	this.context = context;

	this.props = props;

	this.state = this.state || {};
}

extend(Component.prototype, {
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) this.prevState = extend({}, s);
		extend(s, typeof state === 'function' ? state(s, this.props) : state);
		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
		enqueueRender(this);
	},

	forceUpdate(callback) {
		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
		renderComponent(this, FORCE_RENDER);
	},

	render() {}

});

function render(vnode, parent, merge) {
  return diff(merge, vnode, {}, false, parent, false);
}

const EmojiSearch = (_ref) => {
              let onSearch = _ref.onSearch;

              return h("input", { type: "search",
                            "class": "emoji-search",
                            placeholder: "Type to search ...",
                            onInput: event => onSearch(event.target.value) });
};

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var objectDestructuringEmpty = function (obj) {
  if (obj == null) throw new TypeError("Cannot destructure undefined");
};

var objectWithoutProperties = function (obj, keys) {
  var target = {};

  for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
    target[i] = obj[i];
  }

  return target;
};

class Image extends Component {
  constructor() {
    super();

    this._observerCallback = (entries, observer) => {
      if (entries[0].intersectionRatio <= 0) {
        return;
      }

      observer.disconnect();
      this.setState({ loaded: true });
    };

    this.state.loaded = window.IntersectionObserver == null;
  }

  _observe(image) {
    this._unobserve();

    if (!image || this.state.loaded) {
      return;
    }

    this._observer = new IntersectionObserver(this._observerCallback, {
      threshold: 0
    });

    this._observer.observe(image);
  }

  _unobserve() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  componentWillUnmount() {
    this._unobserve();
  }

  render(_ref, _ref2) {
    let loaded = _ref2.loaded;
    let src = _ref.src,
        preview = _ref.preview,
        props = objectWithoutProperties(_ref, ['src', 'preview']);

    const _src = loaded ? src : preview;

    return h('img', _extends({ src: _src, ref: image => this._observe(image) }, props));
  }
}

const EmojiItem = (_ref) => {
  let name = _ref.name,
      image = _ref.image;

  return h(
    'div',
    { 'class': 'emoji-item' },
    h(Image, { src: image, preview: 'https://assets-cdn.github.com/images/icons/emoji/unicode/2754.png?v7', alt: name, 'class': 'image' }),
    h(
      'span',
      null,
      ':',
      name,
      ':'
    )
  );
};

const EmojiList = (_ref) => {
  let items = _ref.items;

  return h(
    'div',
    { 'class': 'emoji-list' },
    items.map((_ref2) => {
      let name = _ref2.name,
          image = _ref2.image;
      return h(EmojiItem, { name: name, image: image });
    })
  );
};

const emojis = [{
  "name": "100",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4af.png?v7"
}, {
  "name": "1234",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f522.png?v7"
}, {
  "name": "+1",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44d.png?v7"
}, {
  "name": "-1",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44e.png?v7"
}, {
  "name": "1st_place_medal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f947.png?v7"
}, {
  "name": "2nd_place_medal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f948.png?v7"
}, {
  "name": "3rd_place_medal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f949.png?v7"
}, {
  "name": "8ball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b1.png?v7"
}, {
  "name": "a",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f170.png?v7"
}, {
  "name": "ab",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f18e.png?v7"
}, {
  "name": "abc",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f524.png?v7"
}, {
  "name": "abcd",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f521.png?v7"
}, {
  "name": "accept",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f251.png?v7"
}, {
  "name": "aerial_tramway",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a1.png?v7"
}, {
  "name": "afghanistan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1eb.png?v7"
}, {
  "name": "airplane",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2708.png?v7"
}, {
  "name": "aland_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1fd.png?v7"
}, {
  "name": "alarm_clock",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23f0.png?v7"
}, {
  "name": "albania",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f1.png?v7"
}, {
  "name": "alembic",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2697.png?v7"
}, {
  "name": "algeria",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e9-1f1ff.png?v7"
}, {
  "name": "alien",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f47d.png?v7"
}, {
  "name": "ambulance",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f691.png?v7"
}, {
  "name": "american_samoa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f8.png?v7"
}, {
  "name": "amphora",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3fa.png?v7"
}, {
  "name": "anchor",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2693.png?v7"
}, {
  "name": "andorra",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1e9.png?v7"
}, {
  "name": "angel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f47c.png?v7"
}, {
  "name": "anger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a2.png?v7"
}, {
  "name": "angola",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f4.png?v7"
}, {
  "name": "angry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f620.png?v7"
}, {
  "name": "anguilla",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1ee.png?v7"
}, {
  "name": "anguished",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f627.png?v7"
}, {
  "name": "ant",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41c.png?v7"
}, {
  "name": "antarctica",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f6.png?v7"
}, {
  "name": "antigua_barbuda",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1ec.png?v7"
}, {
  "name": "apple",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34e.png?v7"
}, {
  "name": "aquarius",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2652.png?v7"
}, {
  "name": "argentina",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f7.png?v7"
}, {
  "name": "aries",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2648.png?v7"
}, {
  "name": "armenia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f2.png?v7"
}, {
  "name": "arrow_backward",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25c0.png?v7"
}, {
  "name": "arrow_double_down",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23ec.png?v7"
}, {
  "name": "arrow_double_up",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23eb.png?v7"
}, {
  "name": "arrow_down",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b07.png?v7"
}, {
  "name": "arrow_down_small",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f53d.png?v7"
}, {
  "name": "arrow_forward",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25b6.png?v7"
}, {
  "name": "arrow_heading_down",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2935.png?v7"
}, {
  "name": "arrow_heading_up",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2934.png?v7"
}, {
  "name": "arrow_left",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b05.png?v7"
}, {
  "name": "arrow_lower_left",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2199.png?v7"
}, {
  "name": "arrow_lower_right",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2198.png?v7"
}, {
  "name": "arrow_right",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/27a1.png?v7"
}, {
  "name": "arrow_right_hook",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/21aa.png?v7"
}, {
  "name": "arrow_up",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b06.png?v7"
}, {
  "name": "arrow_up_down",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2195.png?v7"
}, {
  "name": "arrow_up_small",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f53c.png?v7"
}, {
  "name": "arrow_upper_left",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2196.png?v7"
}, {
  "name": "arrow_upper_right",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2197.png?v7"
}, {
  "name": "arrows_clockwise",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f503.png?v7"
}, {
  "name": "arrows_counterclockwise",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f504.png?v7"
}, {
  "name": "art",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a8.png?v7"
}, {
  "name": "articulated_lorry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f69b.png?v7"
}, {
  "name": "artificial_satellite",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6f0.png?v7"
}, {
  "name": "aruba",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1fc.png?v7"
}, {
  "name": "asterisk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/002a-20e3.png?v7"
}, {
  "name": "astonished",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f632.png?v7"
}, {
  "name": "athletic_shoe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45f.png?v7"
}, {
  "name": "atm",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e7.png?v7"
}, {
  "name": "atom",
  "image": "https://assets-cdn.github.com/images/icons/emoji/atom.png?v7"
}, {
  "name": "atom_symbol",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/269b.png?v7"
}, {
  "name": "australia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1fa.png?v7"
}, {
  "name": "austria",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1f9.png?v7"
}, {
  "name": "avocado",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f951.png?v7"
}, {
  "name": "azerbaijan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1ff.png?v7"
}, {
  "name": "b",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f171.png?v7"
}, {
  "name": "baby",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f476.png?v7"
}, {
  "name": "baby_bottle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f37c.png?v7"
}, {
  "name": "baby_chick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f424.png?v7"
}, {
  "name": "baby_symbol",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6bc.png?v7"
}, {
  "name": "back",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f519.png?v7"
}, {
  "name": "bacon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f953.png?v7"
}, {
  "name": "badminton",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f8.png?v7"
}, {
  "name": "baggage_claim",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6c4.png?v7"
}, {
  "name": "baguette_bread",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f956.png?v7"
}, {
  "name": "bahamas",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f8.png?v7"
}, {
  "name": "bahrain",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1ed.png?v7"
}, {
  "name": "balance_scale",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2696.png?v7"
}, {
  "name": "balloon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f388.png?v7"
}, {
  "name": "ballot_box",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5f3.png?v7"
}, {
  "name": "ballot_box_with_check",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2611.png?v7"
}, {
  "name": "bamboo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f38d.png?v7"
}, {
  "name": "banana",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34c.png?v7"
}, {
  "name": "bangbang",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/203c.png?v7"
}, {
  "name": "bangladesh",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1e9.png?v7"
}, {
  "name": "bank",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e6.png?v7"
}, {
  "name": "bar_chart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ca.png?v7"
}, {
  "name": "barbados",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1e7.png?v7"
}, {
  "name": "barber",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f488.png?v7"
}, {
  "name": "baseball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26be.png?v7"
}, {
  "name": "basecamp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/basecamp.png?v7"
}, {
  "name": "basecampy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/basecampy.png?v7"
}, {
  "name": "basketball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c0.png?v7"
}, {
  "name": "basketball_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f9.png?v7"
}, {
  "name": "basketball_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f9-2640.png?v7"
}, {
  "name": "bat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f987.png?v7"
}, {
  "name": "bath",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6c0.png?v7"
}, {
  "name": "bathtub",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6c1.png?v7"
}, {
  "name": "battery",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f50b.png?v7"
}, {
  "name": "beach_umbrella",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d6.png?v7"
}, {
  "name": "bear",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43b.png?v7"
}, {
  "name": "bed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6cf.png?v7"
}, {
  "name": "bee",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41d.png?v7"
}, {
  "name": "beer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f37a.png?v7"
}, {
  "name": "beers",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f37b.png?v7"
}, {
  "name": "beetle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41e.png?v7"
}, {
  "name": "beginner",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f530.png?v7"
}, {
  "name": "belarus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1fe.png?v7"
}, {
  "name": "belgium",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1ea.png?v7"
}, {
  "name": "belize",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1ff.png?v7"
}, {
  "name": "bell",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f514.png?v7"
}, {
  "name": "bellhop_bell",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ce.png?v7"
}, {
  "name": "benin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1ef.png?v7"
}, {
  "name": "bento",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f371.png?v7"
}, {
  "name": "bermuda",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f2.png?v7"
}, {
  "name": "bhutan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f9.png?v7"
}, {
  "name": "bicyclist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b4.png?v7"
}, {
  "name": "bike",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b2.png?v7"
}, {
  "name": "biking_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b4.png?v7"
}, {
  "name": "biking_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b4-2640.png?v7"
}, {
  "name": "bikini",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f459.png?v7"
}, {
  "name": "biohazard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2623.png?v7"
}, {
  "name": "bird",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f426.png?v7"
}, {
  "name": "birthday",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f382.png?v7"
}, {
  "name": "black_circle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26ab.png?v7"
}, {
  "name": "black_flag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f4.png?v7"
}, {
  "name": "black_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5a4.png?v7"
}, {
  "name": "black_joker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f0cf.png?v7"
}, {
  "name": "black_large_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b1b.png?v7"
}, {
  "name": "black_medium_small_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25fe.png?v7"
}, {
  "name": "black_medium_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25fc.png?v7"
}, {
  "name": "black_nib",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2712.png?v7"
}, {
  "name": "black_small_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25aa.png?v7"
}, {
  "name": "black_square_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f532.png?v7"
}, {
  "name": "blonde_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f471.png?v7"
}, {
  "name": "blonde_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f471-2640.png?v7"
}, {
  "name": "blossom",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f33c.png?v7"
}, {
  "name": "blowfish",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f421.png?v7"
}, {
  "name": "blue_book",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d8.png?v7"
}, {
  "name": "blue_car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f699.png?v7"
}, {
  "name": "blue_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f499.png?v7"
}, {
  "name": "blush",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f60a.png?v7"
}, {
  "name": "boar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f417.png?v7"
}, {
  "name": "boat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f5.png?v7"
}, {
  "name": "bolivia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f4.png?v7"
}, {
  "name": "bomb",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a3.png?v7"
}, {
  "name": "book",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d6.png?v7"
}, {
  "name": "bookmark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f516.png?v7"
}, {
  "name": "bookmark_tabs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d1.png?v7"
}, {
  "name": "books",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4da.png?v7"
}, {
  "name": "boom",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a5.png?v7"
}, {
  "name": "boot",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f462.png?v7"
}, {
  "name": "bosnia_herzegovina",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1e6.png?v7"
}, {
  "name": "botswana",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1fc.png?v7"
}, {
  "name": "bouquet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f490.png?v7"
}, {
  "name": "bow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f647.png?v7"
}, {
  "name": "bow_and_arrow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f9.png?v7"
}, {
  "name": "bowing_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f647.png?v7"
}, {
  "name": "bowing_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f647-2640.png?v7"
}, {
  "name": "bowling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b3.png?v7"
}, {
  "name": "bowtie",
  "image": "https://assets-cdn.github.com/images/icons/emoji/bowtie.png?v7"
}, {
  "name": "boxing_glove",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f94a.png?v7"
}, {
  "name": "boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f466.png?v7"
}, {
  "name": "brazil",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f7.png?v7"
}, {
  "name": "bread",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f35e.png?v7"
}, {
  "name": "bride_with_veil",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f470.png?v7"
}, {
  "name": "bridge_at_night",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f309.png?v7"
}, {
  "name": "briefcase",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4bc.png?v7"
}, {
  "name": "british_indian_ocean_territory",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f4.png?v7"
}, {
  "name": "british_virgin_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1ec.png?v7"
}, {
  "name": "broken_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f494.png?v7"
}, {
  "name": "brunei",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f3.png?v7"
}, {
  "name": "bug",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41b.png?v7"
}, {
  "name": "building_construction",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d7.png?v7"
}, {
  "name": "bulb",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a1.png?v7"
}, {
  "name": "bulgaria",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1ec.png?v7"
}, {
  "name": "bullettrain_front",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f685.png?v7"
}, {
  "name": "bullettrain_side",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f684.png?v7"
}, {
  "name": "burkina_faso",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1eb.png?v7"
}, {
  "name": "burrito",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f32f.png?v7"
}, {
  "name": "burundi",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1ee.png?v7"
}, {
  "name": "bus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f68c.png?v7"
}, {
  "name": "business_suit_levitating",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f574.png?v7"
}, {
  "name": "busstop",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f68f.png?v7"
}, {
  "name": "bust_in_silhouette",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f464.png?v7"
}, {
  "name": "busts_in_silhouette",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f465.png?v7"
}, {
  "name": "butterfly",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f98b.png?v7"
}, {
  "name": "cactus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f335.png?v7"
}, {
  "name": "cake",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f370.png?v7"
}, {
  "name": "calendar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c6.png?v7"
}, {
  "name": "call_me_hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f919.png?v7"
}, {
  "name": "calling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f2.png?v7"
}, {
  "name": "cambodia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1ed.png?v7"
}, {
  "name": "camel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42b.png?v7"
}, {
  "name": "camera",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f7.png?v7"
}, {
  "name": "camera_flash",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f8.png?v7"
}, {
  "name": "cameroon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1f2.png?v7"
}, {
  "name": "camping",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d5.png?v7"
}, {
  "name": "canada",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1e6.png?v7"
}, {
  "name": "canary_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1e8.png?v7"
}, {
  "name": "cancer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/264b.png?v7"
}, {
  "name": "candle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f56f.png?v7"
}, {
  "name": "candy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f36c.png?v7"
}, {
  "name": "canoe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6f6.png?v7"
}, {
  "name": "cape_verde",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1fb.png?v7"
}, {
  "name": "capital_abcd",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f520.png?v7"
}, {
  "name": "capricorn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2651.png?v7"
}, {
  "name": "car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f697.png?v7"
}, {
  "name": "card_file_box",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5c3.png?v7"
}, {
  "name": "card_index",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c7.png?v7"
}, {
  "name": "card_index_dividers",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5c2.png?v7"
}, {
  "name": "caribbean_netherlands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f6.png?v7"
}, {
  "name": "carousel_horse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a0.png?v7"
}, {
  "name": "carrot",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f955.png?v7"
}, {
  "name": "cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f431.png?v7"
}, {
  "name": "cat2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f408.png?v7"
}, {
  "name": "cayman_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1fe.png?v7"
}, {
  "name": "cd",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4bf.png?v7"
}, {
  "name": "central_african_republic",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1eb.png?v7"
}, {
  "name": "chad",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1e9.png?v7"
}, {
  "name": "chains",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26d3.png?v7"
}, {
  "name": "champagne",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f37e.png?v7"
}, {
  "name": "chart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b9.png?v7"
}, {
  "name": "chart_with_downwards_trend",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c9.png?v7"
}, {
  "name": "chart_with_upwards_trend",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c8.png?v7"
}, {
  "name": "checkered_flag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c1.png?v7"
}, {
  "name": "cheese",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f9c0.png?v7"
}, {
  "name": "cherries",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f352.png?v7"
}, {
  "name": "cherry_blossom",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f338.png?v7"
}, {
  "name": "chestnut",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f330.png?v7"
}, {
  "name": "chicken",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f414.png?v7"
}, {
  "name": "children_crossing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b8.png?v7"
}, {
  "name": "chile",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1f1.png?v7"
}, {
  "name": "chipmunk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43f.png?v7"
}, {
  "name": "chocolate_bar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f36b.png?v7"
}, {
  "name": "christmas_island",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1fd.png?v7"
}, {
  "name": "christmas_tree",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f384.png?v7"
}, {
  "name": "church",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26ea.png?v7"
}, {
  "name": "cinema",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a6.png?v7"
}, {
  "name": "circus_tent",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3aa.png?v7"
}, {
  "name": "city_sunrise",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f307.png?v7"
}, {
  "name": "city_sunset",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f306.png?v7"
}, {
  "name": "cityscape",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d9.png?v7"
}, {
  "name": "cl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f191.png?v7"
}, {
  "name": "clamp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5dc.png?v7"
}, {
  "name": "clap",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44f.png?v7"
}, {
  "name": "clapper",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ac.png?v7"
}, {
  "name": "classical_building",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3db.png?v7"
}, {
  "name": "clinking_glasses",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f942.png?v7"
}, {
  "name": "clipboard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4cb.png?v7"
}, {
  "name": "clock1",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f550.png?v7"
}, {
  "name": "clock10",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f559.png?v7"
}, {
  "name": "clock1030",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f565.png?v7"
}, {
  "name": "clock11",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f55a.png?v7"
}, {
  "name": "clock1130",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f566.png?v7"
}, {
  "name": "clock12",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f55b.png?v7"
}, {
  "name": "clock1230",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f567.png?v7"
}, {
  "name": "clock130",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f55c.png?v7"
}, {
  "name": "clock2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f551.png?v7"
}, {
  "name": "clock230",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f55d.png?v7"
}, {
  "name": "clock3",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f552.png?v7"
}, {
  "name": "clock330",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f55e.png?v7"
}, {
  "name": "clock4",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f553.png?v7"
}, {
  "name": "clock430",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f55f.png?v7"
}, {
  "name": "clock5",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f554.png?v7"
}, {
  "name": "clock530",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f560.png?v7"
}, {
  "name": "clock6",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f555.png?v7"
}, {
  "name": "clock630",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f561.png?v7"
}, {
  "name": "clock7",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f556.png?v7"
}, {
  "name": "clock730",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f562.png?v7"
}, {
  "name": "clock8",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f557.png?v7"
}, {
  "name": "clock830",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f563.png?v7"
}, {
  "name": "clock9",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f558.png?v7"
}, {
  "name": "clock930",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f564.png?v7"
}, {
  "name": "closed_book",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d5.png?v7"
}, {
  "name": "closed_lock_with_key",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f510.png?v7"
}, {
  "name": "closed_umbrella",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f302.png?v7"
}, {
  "name": "cloud",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2601.png?v7"
}, {
  "name": "cloud_with_lightning",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f329.png?v7"
}, {
  "name": "cloud_with_lightning_and_rain",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26c8.png?v7"
}, {
  "name": "cloud_with_rain",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f327.png?v7"
}, {
  "name": "cloud_with_snow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f328.png?v7"
}, {
  "name": "clown_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f921.png?v7"
}, {
  "name": "clubs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2663.png?v7"
}, {
  "name": "cn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1f3.png?v7"
}, {
  "name": "cocktail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f378.png?v7"
}, {
  "name": "cocos_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1e8.png?v7"
}, {
  "name": "coffee",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2615.png?v7"
}, {
  "name": "coffin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26b0.png?v7"
}, {
  "name": "cold_sweat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f630.png?v7"
}, {
  "name": "collision",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a5.png?v7"
}, {
  "name": "colombia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1f4.png?v7"
}, {
  "name": "comet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2604.png?v7"
}, {
  "name": "comoros",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1f2.png?v7"
}, {
  "name": "computer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4bb.png?v7"
}, {
  "name": "computer_mouse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5b1.png?v7"
}, {
  "name": "confetti_ball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f38a.png?v7"
}, {
  "name": "confounded",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f616.png?v7"
}, {
  "name": "confused",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f615.png?v7"
}, {
  "name": "congo_brazzaville",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1ec.png?v7"
}, {
  "name": "congo_kinshasa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1e9.png?v7"
}, {
  "name": "congratulations",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/3297.png?v7"
}, {
  "name": "construction",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a7.png?v7"
}, {
  "name": "construction_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f477.png?v7"
}, {
  "name": "construction_worker_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f477.png?v7"
}, {
  "name": "construction_worker_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f477-2640.png?v7"
}, {
  "name": "control_knobs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f39b.png?v7"
}, {
  "name": "convenience_store",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ea.png?v7"
}, {
  "name": "cook_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1f0.png?v7"
}, {
  "name": "cookie",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f36a.png?v7"
}, {
  "name": "cool",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f192.png?v7"
}, {
  "name": "cop",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46e.png?v7"
}, {
  "name": "copyright",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/00a9.png?v7"
}, {
  "name": "corn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f33d.png?v7"
}, {
  "name": "costa_rica",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1f7.png?v7"
}, {
  "name": "cote_divoire",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1ee.png?v7"
}, {
  "name": "couch_and_lamp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6cb.png?v7"
}, {
  "name": "couple",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46b.png?v7"
}, {
  "name": "couple_with_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f491.png?v7"
}, {
  "name": "couple_with_heart_man_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-2764-1f468.png?v7"
}, {
  "name": "couple_with_heart_woman_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f491.png?v7"
}, {
  "name": "couple_with_heart_woman_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-2764-1f469.png?v7"
}, {
  "name": "couplekiss_man_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-2764-1f48b-1f468.png?v7"
}, {
  "name": "couplekiss_man_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f48f.png?v7"
}, {
  "name": "couplekiss_woman_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-2764-1f48b-1f469.png?v7"
}, {
  "name": "cow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42e.png?v7"
}, {
  "name": "cow2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f404.png?v7"
}, {
  "name": "cowboy_hat_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f920.png?v7"
}, {
  "name": "crab",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f980.png?v7"
}, {
  "name": "crayon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f58d.png?v7"
}, {
  "name": "credit_card",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b3.png?v7"
}, {
  "name": "crescent_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f319.png?v7"
}, {
  "name": "cricket",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3cf.png?v7"
}, {
  "name": "croatia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ed-1f1f7.png?v7"
}, {
  "name": "crocodile",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f40a.png?v7"
}, {
  "name": "croissant",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f950.png?v7"
}, {
  "name": "crossed_fingers",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f91e.png?v7"
}, {
  "name": "crossed_flags",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f38c.png?v7"
}, {
  "name": "crossed_swords",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2694.png?v7"
}, {
  "name": "crown",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f451.png?v7"
}, {
  "name": "cry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f622.png?v7"
}, {
  "name": "crying_cat_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f63f.png?v7"
}, {
  "name": "crystal_ball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52e.png?v7"
}, {
  "name": "cuba",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1fa.png?v7"
}, {
  "name": "cucumber",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f952.png?v7"
}, {
  "name": "cupid",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f498.png?v7"
}, {
  "name": "curacao",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1fc.png?v7"
}, {
  "name": "curly_loop",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/27b0.png?v7"
}, {
  "name": "currency_exchange",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b1.png?v7"
}, {
  "name": "curry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f35b.png?v7"
}, {
  "name": "custard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f36e.png?v7"
}, {
  "name": "customs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6c3.png?v7"
}, {
  "name": "cyclone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f300.png?v7"
}, {
  "name": "cyprus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1fe.png?v7"
}, {
  "name": "czech_republic",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1ff.png?v7"
}, {
  "name": "dagger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5e1.png?v7"
}, {
  "name": "dancer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f483.png?v7"
}, {
  "name": "dancers",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46f.png?v7"
}, {
  "name": "dancing_men",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46f-2642.png?v7"
}, {
  "name": "dancing_women",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46f.png?v7"
}, {
  "name": "dango",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f361.png?v7"
}, {
  "name": "dark_sunglasses",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f576.png?v7"
}, {
  "name": "dart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3af.png?v7"
}, {
  "name": "dash",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a8.png?v7"
}, {
  "name": "date",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c5.png?v7"
}, {
  "name": "de",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e9-1f1ea.png?v7"
}, {
  "name": "deciduous_tree",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f333.png?v7"
}, {
  "name": "deer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f98c.png?v7"
}, {
  "name": "denmark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e9-1f1f0.png?v7"
}, {
  "name": "department_store",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ec.png?v7"
}, {
  "name": "derelict_house",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3da.png?v7"
}, {
  "name": "desert",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3dc.png?v7"
}, {
  "name": "desert_island",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3dd.png?v7"
}, {
  "name": "desktop_computer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5a5.png?v7"
}, {
  "name": "detective",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f575.png?v7"
}, {
  "name": "diamond_shape_with_a_dot_inside",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a0.png?v7"
}, {
  "name": "diamonds",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2666.png?v7"
}, {
  "name": "disappointed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f61e.png?v7"
}, {
  "name": "disappointed_relieved",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f625.png?v7"
}, {
  "name": "dizzy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ab.png?v7"
}, {
  "name": "dizzy_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f635.png?v7"
}, {
  "name": "djibouti",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e9-1f1ef.png?v7"
}, {
  "name": "do_not_litter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6af.png?v7"
}, {
  "name": "dog",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f436.png?v7"
}, {
  "name": "dog2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f415.png?v7"
}, {
  "name": "dollar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b5.png?v7"
}, {
  "name": "dolls",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f38e.png?v7"
}, {
  "name": "dolphin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42c.png?v7"
}, {
  "name": "dominica",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e9-1f1f2.png?v7"
}, {
  "name": "dominican_republic",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e9-1f1f4.png?v7"
}, {
  "name": "door",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6aa.png?v7"
}, {
  "name": "doughnut",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f369.png?v7"
}, {
  "name": "dove",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f54a.png?v7"
}, {
  "name": "dragon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f409.png?v7"
}, {
  "name": "dragon_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f432.png?v7"
}, {
  "name": "dress",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f457.png?v7"
}, {
  "name": "dromedary_camel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42a.png?v7"
}, {
  "name": "drooling_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f924.png?v7"
}, {
  "name": "droplet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a7.png?v7"
}, {
  "name": "drum",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f941.png?v7"
}, {
  "name": "duck",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f986.png?v7"
}, {
  "name": "dvd",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c0.png?v7"
}, {
  "name": "e-mail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e7.png?v7"
}, {
  "name": "eagle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f985.png?v7"
}, {
  "name": "ear",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f442.png?v7"
}, {
  "name": "ear_of_rice",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f33e.png?v7"
}, {
  "name": "earth_africa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f30d.png?v7"
}, {
  "name": "earth_americas",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f30e.png?v7"
}, {
  "name": "earth_asia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f30f.png?v7"
}, {
  "name": "ecuador",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1e8.png?v7"
}, {
  "name": "egg",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f95a.png?v7"
}, {
  "name": "eggplant",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f346.png?v7"
}, {
  "name": "egypt",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1ec.png?v7"
}, {
  "name": "eight",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0038-20e3.png?v7"
}, {
  "name": "eight_pointed_black_star",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2734.png?v7"
}, {
  "name": "eight_spoked_asterisk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2733.png?v7"
}, {
  "name": "el_salvador",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1fb.png?v7"
}, {
  "name": "electric_plug",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f50c.png?v7"
}, {
  "name": "electron",
  "image": "https://assets-cdn.github.com/images/icons/emoji/electron.png?v7"
}, {
  "name": "elephant",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f418.png?v7"
}, {
  "name": "email",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2709.png?v7"
}, {
  "name": "end",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f51a.png?v7"
}, {
  "name": "envelope",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2709.png?v7"
}, {
  "name": "envelope_with_arrow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e9.png?v7"
}, {
  "name": "equatorial_guinea",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f6.png?v7"
}, {
  "name": "eritrea",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1f7.png?v7"
}, {
  "name": "es",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1f8.png?v7"
}, {
  "name": "estonia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1ea.png?v7"
}, {
  "name": "ethiopia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1f9.png?v7"
}, {
  "name": "eu",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1fa.png?v7"
}, {
  "name": "euro",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b6.png?v7"
}, {
  "name": "european_castle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f0.png?v7"
}, {
  "name": "european_post_office",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e4.png?v7"
}, {
  "name": "european_union",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1fa.png?v7"
}, {
  "name": "evergreen_tree",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f332.png?v7"
}, {
  "name": "exclamation",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2757.png?v7"
}, {
  "name": "expressionless",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f611.png?v7"
}, {
  "name": "eye",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f441.png?v7"
}, {
  "name": "eye_speech_bubble",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f441-1f5e8.png?v7"
}, {
  "name": "eyeglasses",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f453.png?v7"
}, {
  "name": "eyes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f440.png?v7"
}, {
  "name": "face_with_head_bandage",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f915.png?v7"
}, {
  "name": "face_with_thermometer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f912.png?v7"
}, {
  "name": "facepunch",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44a.png?v7"
}, {
  "name": "factory",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ed.png?v7"
}, {
  "name": "falkland_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1eb-1f1f0.png?v7"
}, {
  "name": "fallen_leaf",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f342.png?v7"
}, {
  "name": "family",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46a.png?v7"
}, {
  "name": "family_man_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f466.png?v7"
}, {
  "name": "family_man_boy_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f466-1f466.png?v7"
}, {
  "name": "family_man_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f467.png?v7"
}, {
  "name": "family_man_girl_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f467-1f466.png?v7"
}, {
  "name": "family_man_girl_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f467-1f467.png?v7"
}, {
  "name": "family_man_man_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f468-1f466.png?v7"
}, {
  "name": "family_man_man_boy_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f468-1f466-1f466.png?v7"
}, {
  "name": "family_man_man_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f468-1f467.png?v7"
}, {
  "name": "family_man_man_girl_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f468-1f467-1f466.png?v7"
}, {
  "name": "family_man_man_girl_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f468-1f467-1f467.png?v7"
}, {
  "name": "family_man_woman_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46a.png?v7"
}, {
  "name": "family_man_woman_boy_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f469-1f466-1f466.png?v7"
}, {
  "name": "family_man_woman_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f469-1f467.png?v7"
}, {
  "name": "family_man_woman_girl_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f469-1f467-1f466.png?v7"
}, {
  "name": "family_man_woman_girl_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f469-1f467-1f467.png?v7"
}, {
  "name": "family_woman_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f466.png?v7"
}, {
  "name": "family_woman_boy_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f466-1f466.png?v7"
}, {
  "name": "family_woman_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f467.png?v7"
}, {
  "name": "family_woman_girl_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f467-1f466.png?v7"
}, {
  "name": "family_woman_girl_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f467-1f467.png?v7"
}, {
  "name": "family_woman_woman_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f469-1f466.png?v7"
}, {
  "name": "family_woman_woman_boy_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f469-1f466-1f466.png?v7"
}, {
  "name": "family_woman_woman_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f469-1f467.png?v7"
}, {
  "name": "family_woman_woman_girl_boy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f469-1f467-1f466.png?v7"
}, {
  "name": "family_woman_woman_girl_girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f469-1f467-1f467.png?v7"
}, {
  "name": "faroe_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1eb-1f1f4.png?v7"
}, {
  "name": "fast_forward",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23e9.png?v7"
}, {
  "name": "fax",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e0.png?v7"
}, {
  "name": "fearful",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f628.png?v7"
}, {
  "name": "feelsgood",
  "image": "https://assets-cdn.github.com/images/icons/emoji/feelsgood.png?v7"
}, {
  "name": "feet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43e.png?v7"
}, {
  "name": "female_detective",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f575-2640.png?v7"
}, {
  "name": "ferris_wheel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a1.png?v7"
}, {
  "name": "ferry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f4.png?v7"
}, {
  "name": "field_hockey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d1.png?v7"
}, {
  "name": "fiji",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1eb-1f1ef.png?v7"
}, {
  "name": "file_cabinet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5c4.png?v7"
}, {
  "name": "file_folder",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c1.png?v7"
}, {
  "name": "film_projector",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4fd.png?v7"
}, {
  "name": "film_strip",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f39e.png?v7"
}, {
  "name": "finland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1eb-1f1ee.png?v7"
}, {
  "name": "finnadie",
  "image": "https://assets-cdn.github.com/images/icons/emoji/finnadie.png?v7"
}, {
  "name": "fire",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f525.png?v7"
}, {
  "name": "fire_engine",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f692.png?v7"
}, {
  "name": "fireworks",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f386.png?v7"
}, {
  "name": "first_quarter_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f313.png?v7"
}, {
  "name": "first_quarter_moon_with_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f31b.png?v7"
}, {
  "name": "fish",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41f.png?v7"
}, {
  "name": "fish_cake",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f365.png?v7"
}, {
  "name": "fishing_pole_and_fish",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a3.png?v7"
}, {
  "name": "fist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270a.png?v7"
}, {
  "name": "fist_left",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f91b.png?v7"
}, {
  "name": "fist_oncoming",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44a.png?v7"
}, {
  "name": "fist_raised",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270a.png?v7"
}, {
  "name": "fist_right",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f91c.png?v7"
}, {
  "name": "five",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0035-20e3.png?v7"
}, {
  "name": "flags",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f38f.png?v7"
}, {
  "name": "flashlight",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f526.png?v7"
}, {
  "name": "fleur_de_lis",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/269c.png?v7"
}, {
  "name": "flight_arrival",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ec.png?v7"
}, {
  "name": "flight_departure",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6eb.png?v7"
}, {
  "name": "flipper",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42c.png?v7"
}, {
  "name": "floppy_disk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4be.png?v7"
}, {
  "name": "flower_playing_cards",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b4.png?v7"
}, {
  "name": "flushed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f633.png?v7"
}, {
  "name": "fog",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f32b.png?v7"
}, {
  "name": "foggy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f301.png?v7"
}, {
  "name": "football",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c8.png?v7"
}, {
  "name": "footprints",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f463.png?v7"
}, {
  "name": "fork_and_knife",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f374.png?v7"
}, {
  "name": "fountain",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f2.png?v7"
}, {
  "name": "fountain_pen",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f58b.png?v7"
}, {
  "name": "four",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0034-20e3.png?v7"
}, {
  "name": "four_leaf_clover",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f340.png?v7"
}, {
  "name": "fox_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f98a.png?v7"
}, {
  "name": "fr",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1eb-1f1f7.png?v7"
}, {
  "name": "framed_picture",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5bc.png?v7"
}, {
  "name": "free",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f193.png?v7"
}, {
  "name": "french_guiana",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1eb.png?v7"
}, {
  "name": "french_polynesia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1eb.png?v7"
}, {
  "name": "french_southern_territories",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1eb.png?v7"
}, {
  "name": "fried_egg",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f373.png?v7"
}, {
  "name": "fried_shrimp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f364.png?v7"
}, {
  "name": "fries",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f35f.png?v7"
}, {
  "name": "frog",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f438.png?v7"
}, {
  "name": "frowning",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f626.png?v7"
}, {
  "name": "frowning_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2639.png?v7"
}, {
  "name": "frowning_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64d-2642.png?v7"
}, {
  "name": "frowning_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64d.png?v7"
}, {
  "name": "fu",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f595.png?v7"
}, {
  "name": "fuelpump",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26fd.png?v7"
}, {
  "name": "full_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f315.png?v7"
}, {
  "name": "full_moon_with_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f31d.png?v7"
}, {
  "name": "funeral_urn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26b1.png?v7"
}, {
  "name": "gabon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1e6.png?v7"
}, {
  "name": "gambia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f2.png?v7"
}, {
  "name": "game_die",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b2.png?v7"
}, {
  "name": "gb",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1e7.png?v7"
}, {
  "name": "gear",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2699.png?v7"
}, {
  "name": "gem",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f48e.png?v7"
}, {
  "name": "gemini",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/264a.png?v7"
}, {
  "name": "georgia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1ea.png?v7"
}, {
  "name": "ghana",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1ed.png?v7"
}, {
  "name": "ghost",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f47b.png?v7"
}, {
  "name": "gibraltar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1ee.png?v7"
}, {
  "name": "gift",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f381.png?v7"
}, {
  "name": "gift_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f49d.png?v7"
}, {
  "name": "girl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f467.png?v7"
}, {
  "name": "globe_with_meridians",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f310.png?v7"
}, {
  "name": "goal_net",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f945.png?v7"
}, {
  "name": "goat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f410.png?v7"
}, {
  "name": "goberserk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/goberserk.png?v7"
}, {
  "name": "godmode",
  "image": "https://assets-cdn.github.com/images/icons/emoji/godmode.png?v7"
}, {
  "name": "golf",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f3.png?v7"
}, {
  "name": "golfing_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3cc.png?v7"
}, {
  "name": "golfing_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3cc-2640.png?v7"
}, {
  "name": "gorilla",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f98d.png?v7"
}, {
  "name": "grapes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f347.png?v7"
}, {
  "name": "greece",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f7.png?v7"
}, {
  "name": "green_apple",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34f.png?v7"
}, {
  "name": "green_book",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d7.png?v7"
}, {
  "name": "green_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f49a.png?v7"
}, {
  "name": "green_salad",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f957.png?v7"
}, {
  "name": "greenland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f1.png?v7"
}, {
  "name": "grenada",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1e9.png?v7"
}, {
  "name": "grey_exclamation",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2755.png?v7"
}, {
  "name": "grey_question",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2754.png?v7"
}, {
  "name": "grimacing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f62c.png?v7"
}, {
  "name": "grin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f601.png?v7"
}, {
  "name": "grinning",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f600.png?v7"
}, {
  "name": "guadeloupe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f5.png?v7"
}, {
  "name": "guam",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1fa.png?v7"
}, {
  "name": "guardsman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f482.png?v7"
}, {
  "name": "guardswoman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f482-2640.png?v7"
}, {
  "name": "guatemala",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f9.png?v7"
}, {
  "name": "guernsey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1ec.png?v7"
}, {
  "name": "guinea",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f3.png?v7"
}, {
  "name": "guinea_bissau",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1fc.png?v7"
}, {
  "name": "guitar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b8.png?v7"
}, {
  "name": "gun",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52b.png?v7"
}, {
  "name": "guyana",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1fe.png?v7"
}, {
  "name": "haircut",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f487.png?v7"
}, {
  "name": "haircut_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f487-2642.png?v7"
}, {
  "name": "haircut_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f487.png?v7"
}, {
  "name": "haiti",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ed-1f1f9.png?v7"
}, {
  "name": "hamburger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f354.png?v7"
}, {
  "name": "hammer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f528.png?v7"
}, {
  "name": "hammer_and_pick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2692.png?v7"
}, {
  "name": "hammer_and_wrench",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e0.png?v7"
}, {
  "name": "hamster",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f439.png?v7"
}, {
  "name": "hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270b.png?v7"
}, {
  "name": "handbag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45c.png?v7"
}, {
  "name": "handshake",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f91d.png?v7"
}, {
  "name": "hankey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a9.png?v7"
}, {
  "name": "hash",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0023-20e3.png?v7"
}, {
  "name": "hatched_chick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f425.png?v7"
}, {
  "name": "hatching_chick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f423.png?v7"
}, {
  "name": "headphones",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a7.png?v7"
}, {
  "name": "hear_no_evil",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f649.png?v7"
}, {
  "name": "heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2764.png?v7"
}, {
  "name": "heart_decoration",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f49f.png?v7"
}, {
  "name": "heart_eyes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f60d.png?v7"
}, {
  "name": "heart_eyes_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f63b.png?v7"
}, {
  "name": "heartbeat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f493.png?v7"
}, {
  "name": "heartpulse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f497.png?v7"
}, {
  "name": "hearts",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2665.png?v7"
}, {
  "name": "heavy_check_mark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2714.png?v7"
}, {
  "name": "heavy_division_sign",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2797.png?v7"
}, {
  "name": "heavy_dollar_sign",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b2.png?v7"
}, {
  "name": "heavy_exclamation_mark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2757.png?v7"
}, {
  "name": "heavy_heart_exclamation",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2763.png?v7"
}, {
  "name": "heavy_minus_sign",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2796.png?v7"
}, {
  "name": "heavy_multiplication_x",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2716.png?v7"
}, {
  "name": "heavy_plus_sign",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2795.png?v7"
}, {
  "name": "helicopter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f681.png?v7"
}, {
  "name": "herb",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f33f.png?v7"
}, {
  "name": "hibiscus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f33a.png?v7"
}, {
  "name": "high_brightness",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f506.png?v7"
}, {
  "name": "high_heel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f460.png?v7"
}, {
  "name": "hocho",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52a.png?v7"
}, {
  "name": "hole",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f573.png?v7"
}, {
  "name": "honduras",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ed-1f1f3.png?v7"
}, {
  "name": "honey_pot",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f36f.png?v7"
}, {
  "name": "honeybee",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41d.png?v7"
}, {
  "name": "hong_kong",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ed-1f1f0.png?v7"
}, {
  "name": "horse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f434.png?v7"
}, {
  "name": "horse_racing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c7.png?v7"
}, {
  "name": "hospital",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e5.png?v7"
}, {
  "name": "hot_pepper",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f336.png?v7"
}, {
  "name": "hotdog",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f32d.png?v7"
}, {
  "name": "hotel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e8.png?v7"
}, {
  "name": "hotsprings",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2668.png?v7"
}, {
  "name": "hourglass",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/231b.png?v7"
}, {
  "name": "hourglass_flowing_sand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23f3.png?v7"
}, {
  "name": "house",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e0.png?v7"
}, {
  "name": "house_with_garden",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e1.png?v7"
}, {
  "name": "houses",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d8.png?v7"
}, {
  "name": "hugs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f917.png?v7"
}, {
  "name": "hungary",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ed-1f1fa.png?v7"
}, {
  "name": "hurtrealbad",
  "image": "https://assets-cdn.github.com/images/icons/emoji/hurtrealbad.png?v7"
}, {
  "name": "hushed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f62f.png?v7"
}, {
  "name": "ice_cream",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f368.png?v7"
}, {
  "name": "ice_hockey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d2.png?v7"
}, {
  "name": "ice_skate",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f8.png?v7"
}, {
  "name": "icecream",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f366.png?v7"
}, {
  "name": "iceland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f8.png?v7"
}, {
  "name": "id",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f194.png?v7"
}, {
  "name": "ideograph_advantage",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f250.png?v7"
}, {
  "name": "imp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f47f.png?v7"
}, {
  "name": "inbox_tray",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e5.png?v7"
}, {
  "name": "incoming_envelope",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e8.png?v7"
}, {
  "name": "india",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f3.png?v7"
}, {
  "name": "indonesia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1e9.png?v7"
}, {
  "name": "information_desk_person",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f481.png?v7"
}, {
  "name": "information_source",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2139.png?v7"
}, {
  "name": "innocent",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f607.png?v7"
}, {
  "name": "interrobang",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2049.png?v7"
}, {
  "name": "iphone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f1.png?v7"
}, {
  "name": "iran",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f7.png?v7"
}, {
  "name": "iraq",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f6.png?v7"
}, {
  "name": "ireland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1ea.png?v7"
}, {
  "name": "isle_of_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f2.png?v7"
}, {
  "name": "israel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f1.png?v7"
}, {
  "name": "it",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ee-1f1f9.png?v7"
}, {
  "name": "izakaya_lantern",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ee.png?v7"
}, {
  "name": "jack_o_lantern",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f383.png?v7"
}, {
  "name": "jamaica",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ef-1f1f2.png?v7"
}, {
  "name": "japan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5fe.png?v7"
}, {
  "name": "japanese_castle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ef.png?v7"
}, {
  "name": "japanese_goblin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f47a.png?v7"
}, {
  "name": "japanese_ogre",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f479.png?v7"
}, {
  "name": "jeans",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f456.png?v7"
}, {
  "name": "jersey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ef-1f1ea.png?v7"
}, {
  "name": "jordan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ef-1f1f4.png?v7"
}, {
  "name": "joy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f602.png?v7"
}, {
  "name": "joy_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f639.png?v7"
}, {
  "name": "joystick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f579.png?v7"
}, {
  "name": "jp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ef-1f1f5.png?v7"
}, {
  "name": "kaaba",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f54b.png?v7"
}, {
  "name": "kazakhstan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1ff.png?v7"
}, {
  "name": "kenya",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1ea.png?v7"
}, {
  "name": "key",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f511.png?v7"
}, {
  "name": "keyboard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2328.png?v7"
}, {
  "name": "keycap_ten",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f51f.png?v7"
}, {
  "name": "kick_scooter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6f4.png?v7"
}, {
  "name": "kimono",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f458.png?v7"
}, {
  "name": "kiribati",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1ee.png?v7"
}, {
  "name": "kiss",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f48b.png?v7"
}, {
  "name": "kissing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f617.png?v7"
}, {
  "name": "kissing_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f63d.png?v7"
}, {
  "name": "kissing_closed_eyes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f61a.png?v7"
}, {
  "name": "kissing_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f618.png?v7"
}, {
  "name": "kissing_smiling_eyes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f619.png?v7"
}, {
  "name": "kiwi_fruit",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f95d.png?v7"
}, {
  "name": "knife",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52a.png?v7"
}, {
  "name": "koala",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f428.png?v7"
}, {
  "name": "koko",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f201.png?v7"
}, {
  "name": "kosovo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fd-1f1f0.png?v7"
}, {
  "name": "kr",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1f7.png?v7"
}, {
  "name": "kuwait",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1fc.png?v7"
}, {
  "name": "kyrgyzstan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1ec.png?v7"
}, {
  "name": "label",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f7.png?v7"
}, {
  "name": "lantern",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ee.png?v7"
}, {
  "name": "laos",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1e6.png?v7"
}, {
  "name": "large_blue_circle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f535.png?v7"
}, {
  "name": "large_blue_diamond",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f537.png?v7"
}, {
  "name": "large_orange_diamond",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f536.png?v7"
}, {
  "name": "last_quarter_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f317.png?v7"
}, {
  "name": "last_quarter_moon_with_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f31c.png?v7"
}, {
  "name": "latin_cross",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/271d.png?v7"
}, {
  "name": "latvia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1fb.png?v7"
}, {
  "name": "laughing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f606.png?v7"
}, {
  "name": "leaves",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f343.png?v7"
}, {
  "name": "lebanon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1e7.png?v7"
}, {
  "name": "ledger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d2.png?v7"
}, {
  "name": "left_luggage",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6c5.png?v7"
}, {
  "name": "left_right_arrow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2194.png?v7"
}, {
  "name": "leftwards_arrow_with_hook",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/21a9.png?v7"
}, {
  "name": "lemon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34b.png?v7"
}, {
  "name": "leo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/264c.png?v7"
}, {
  "name": "leopard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f406.png?v7"
}, {
  "name": "lesotho",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1f8.png?v7"
}, {
  "name": "level_slider",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f39a.png?v7"
}, {
  "name": "liberia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1f7.png?v7"
}, {
  "name": "libra",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/264e.png?v7"
}, {
  "name": "libya",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1fe.png?v7"
}, {
  "name": "liechtenstein",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1ee.png?v7"
}, {
  "name": "light_rail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f688.png?v7"
}, {
  "name": "link",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f517.png?v7"
}, {
  "name": "lion",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f981.png?v7"
}, {
  "name": "lips",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f444.png?v7"
}, {
  "name": "lipstick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f484.png?v7"
}, {
  "name": "lithuania",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1f9.png?v7"
}, {
  "name": "lizard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f98e.png?v7"
}, {
  "name": "lock",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f512.png?v7"
}, {
  "name": "lock_with_ink_pen",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f50f.png?v7"
}, {
  "name": "lollipop",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f36d.png?v7"
}, {
  "name": "loop",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/27bf.png?v7"
}, {
  "name": "loud_sound",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f50a.png?v7"
}, {
  "name": "loudspeaker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e2.png?v7"
}, {
  "name": "love_hotel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e9.png?v7"
}, {
  "name": "love_letter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f48c.png?v7"
}, {
  "name": "low_brightness",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f505.png?v7"
}, {
  "name": "luxembourg",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1fa.png?v7"
}, {
  "name": "lying_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f925.png?v7"
}, {
  "name": "m",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/24c2.png?v7"
}, {
  "name": "macau",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f4.png?v7"
}, {
  "name": "macedonia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f0.png?v7"
}, {
  "name": "madagascar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1ec.png?v7"
}, {
  "name": "mag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f50d.png?v7"
}, {
  "name": "mag_right",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f50e.png?v7"
}, {
  "name": "mahjong",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f004.png?v7"
}, {
  "name": "mailbox",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4eb.png?v7"
}, {
  "name": "mailbox_closed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ea.png?v7"
}, {
  "name": "mailbox_with_mail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ec.png?v7"
}, {
  "name": "mailbox_with_no_mail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ed.png?v7"
}, {
  "name": "malawi",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1fc.png?v7"
}, {
  "name": "malaysia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1fe.png?v7"
}, {
  "name": "maldives",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1fb.png?v7"
}, {
  "name": "male_detective",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f575.png?v7"
}, {
  "name": "mali",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f1.png?v7"
}, {
  "name": "malta",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f9.png?v7"
}, {
  "name": "man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468.png?v7"
}, {
  "name": "man_artist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f3a8.png?v7"
}, {
  "name": "man_astronaut",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f680.png?v7"
}, {
  "name": "man_cartwheeling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f938-2642.png?v7"
}, {
  "name": "man_cook",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f373.png?v7"
}, {
  "name": "man_dancing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f57a.png?v7"
}, {
  "name": "man_facepalming",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f926-2642.png?v7"
}, {
  "name": "man_factory_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f3ed.png?v7"
}, {
  "name": "man_farmer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f33e.png?v7"
}, {
  "name": "man_firefighter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f692.png?v7"
}, {
  "name": "man_health_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-2695.png?v7"
}, {
  "name": "man_in_tuxedo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f935.png?v7"
}, {
  "name": "man_judge",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-2696.png?v7"
}, {
  "name": "man_juggling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f939-2642.png?v7"
}, {
  "name": "man_mechanic",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f527.png?v7"
}, {
  "name": "man_office_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f4bc.png?v7"
}, {
  "name": "man_pilot",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-2708.png?v7"
}, {
  "name": "man_playing_handball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93e-2642.png?v7"
}, {
  "name": "man_playing_water_polo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93d-2642.png?v7"
}, {
  "name": "man_scientist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f52c.png?v7"
}, {
  "name": "man_shrugging",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f937-2642.png?v7"
}, {
  "name": "man_singer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f3a4.png?v7"
}, {
  "name": "man_student",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f393.png?v7"
}, {
  "name": "man_teacher",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f3eb.png?v7"
}, {
  "name": "man_technologist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f468-1f4bb.png?v7"
}, {
  "name": "man_with_gua_pi_mao",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f472.png?v7"
}, {
  "name": "man_with_turban",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f473.png?v7"
}, {
  "name": "mandarin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34a.png?v7"
}, {
  "name": "mans_shoe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45e.png?v7"
}, {
  "name": "mantelpiece_clock",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f570.png?v7"
}, {
  "name": "maple_leaf",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f341.png?v7"
}, {
  "name": "marshall_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1ed.png?v7"
}, {
  "name": "martial_arts_uniform",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f94b.png?v7"
}, {
  "name": "martinique",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f6.png?v7"
}, {
  "name": "mask",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f637.png?v7"
}, {
  "name": "massage",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f486.png?v7"
}, {
  "name": "massage_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f486-2642.png?v7"
}, {
  "name": "massage_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f486.png?v7"
}, {
  "name": "mauritania",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f7.png?v7"
}, {
  "name": "mauritius",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1fa.png?v7"
}, {
  "name": "mayotte",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fe-1f1f9.png?v7"
}, {
  "name": "meat_on_bone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f356.png?v7"
}, {
  "name": "medal_military",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f396.png?v7"
}, {
  "name": "medal_sports",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c5.png?v7"
}, {
  "name": "mega",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e3.png?v7"
}, {
  "name": "melon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f348.png?v7"
}, {
  "name": "memo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4dd.png?v7"
}, {
  "name": "men_wrestling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93c-2642.png?v7"
}, {
  "name": "menorah",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f54e.png?v7"
}, {
  "name": "mens",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b9.png?v7"
}, {
  "name": "metal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f918.png?v7"
}, {
  "name": "metro",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f687.png?v7"
}, {
  "name": "mexico",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1fd.png?v7"
}, {
  "name": "micronesia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1eb-1f1f2.png?v7"
}, {
  "name": "microphone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a4.png?v7"
}, {
  "name": "microscope",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52c.png?v7"
}, {
  "name": "middle_finger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f595.png?v7"
}, {
  "name": "milk_glass",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f95b.png?v7"
}, {
  "name": "milky_way",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f30c.png?v7"
}, {
  "name": "minibus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f690.png?v7"
}, {
  "name": "minidisc",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4bd.png?v7"
}, {
  "name": "mobile_phone_off",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f4.png?v7"
}, {
  "name": "moldova",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1e9.png?v7"
}, {
  "name": "monaco",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1e8.png?v7"
}, {
  "name": "money_mouth_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f911.png?v7"
}, {
  "name": "money_with_wings",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b8.png?v7"
}, {
  "name": "moneybag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b0.png?v7"
}, {
  "name": "mongolia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f3.png?v7"
}, {
  "name": "monkey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f412.png?v7"
}, {
  "name": "monkey_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f435.png?v7"
}, {
  "name": "monorail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f69d.png?v7"
}, {
  "name": "montenegro",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1ea.png?v7"
}, {
  "name": "montserrat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f8.png?v7"
}, {
  "name": "moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f314.png?v7"
}, {
  "name": "morocco",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1e6.png?v7"
}, {
  "name": "mortar_board",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f393.png?v7"
}, {
  "name": "mosque",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f54c.png?v7"
}, {
  "name": "motor_boat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e5.png?v7"
}, {
  "name": "motor_scooter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6f5.png?v7"
}, {
  "name": "motorcycle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3cd.png?v7"
}, {
  "name": "motorway",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e3.png?v7"
}, {
  "name": "mount_fuji",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5fb.png?v7"
}, {
  "name": "mountain",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f0.png?v7"
}, {
  "name": "mountain_bicyclist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b5.png?v7"
}, {
  "name": "mountain_biking_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b5.png?v7"
}, {
  "name": "mountain_biking_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b5-2640.png?v7"
}, {
  "name": "mountain_cableway",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a0.png?v7"
}, {
  "name": "mountain_railway",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f69e.png?v7"
}, {
  "name": "mountain_snow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d4.png?v7"
}, {
  "name": "mouse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42d.png?v7"
}, {
  "name": "mouse2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f401.png?v7"
}, {
  "name": "movie_camera",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a5.png?v7"
}, {
  "name": "moyai",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5ff.png?v7"
}, {
  "name": "mozambique",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1ff.png?v7"
}, {
  "name": "mrs_claus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f936.png?v7"
}, {
  "name": "muscle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4aa.png?v7"
}, {
  "name": "mushroom",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f344.png?v7"
}, {
  "name": "musical_keyboard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b9.png?v7"
}, {
  "name": "musical_note",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b5.png?v7"
}, {
  "name": "musical_score",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3bc.png?v7"
}, {
  "name": "mute",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f507.png?v7"
}, {
  "name": "myanmar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f2.png?v7"
}, {
  "name": "nail_care",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f485.png?v7"
}, {
  "name": "name_badge",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4db.png?v7"
}, {
  "name": "namibia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1e6.png?v7"
}, {
  "name": "national_park",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3de.png?v7"
}, {
  "name": "nauru",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1f7.png?v7"
}, {
  "name": "nauseated_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f922.png?v7"
}, {
  "name": "neckbeard",
  "image": "https://assets-cdn.github.com/images/icons/emoji/neckbeard.png?v7"
}, {
  "name": "necktie",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f454.png?v7"
}, {
  "name": "negative_squared_cross_mark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/274e.png?v7"
}, {
  "name": "nepal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1f5.png?v7"
}, {
  "name": "nerd_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f913.png?v7"
}, {
  "name": "netherlands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1f1.png?v7"
}, {
  "name": "neutral_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f610.png?v7"
}, {
  "name": "new",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f195.png?v7"
}, {
  "name": "new_caledonia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1e8.png?v7"
}, {
  "name": "new_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f311.png?v7"
}, {
  "name": "new_moon_with_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f31a.png?v7"
}, {
  "name": "new_zealand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1ff.png?v7"
}, {
  "name": "newspaper",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f0.png?v7"
}, {
  "name": "newspaper_roll",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5de.png?v7"
}, {
  "name": "next_track_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23ed.png?v7"
}, {
  "name": "ng",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f196.png?v7"
}, {
  "name": "ng_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f645-2642.png?v7"
}, {
  "name": "ng_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f645.png?v7"
}, {
  "name": "nicaragua",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1ee.png?v7"
}, {
  "name": "niger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1ea.png?v7"
}, {
  "name": "nigeria",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1ec.png?v7"
}, {
  "name": "night_with_stars",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f303.png?v7"
}, {
  "name": "nine",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0039-20e3.png?v7"
}, {
  "name": "niue",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1fa.png?v7"
}, {
  "name": "no_bell",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f515.png?v7"
}, {
  "name": "no_bicycles",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b3.png?v7"
}, {
  "name": "no_entry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26d4.png?v7"
}, {
  "name": "no_entry_sign",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ab.png?v7"
}, {
  "name": "no_good",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f645.png?v7"
}, {
  "name": "no_good_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f645-2642.png?v7"
}, {
  "name": "no_good_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f645.png?v7"
}, {
  "name": "no_mobile_phones",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f5.png?v7"
}, {
  "name": "no_mouth",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f636.png?v7"
}, {
  "name": "no_pedestrians",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b7.png?v7"
}, {
  "name": "no_smoking",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ad.png?v7"
}, {
  "name": "non-potable_water",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b1.png?v7"
}, {
  "name": "norfolk_island",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1eb.png?v7"
}, {
  "name": "north_korea",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1f5.png?v7"
}, {
  "name": "northern_mariana_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f2-1f1f5.png?v7"
}, {
  "name": "norway",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f3-1f1f4.png?v7"
}, {
  "name": "nose",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f443.png?v7"
}, {
  "name": "notebook",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d3.png?v7"
}, {
  "name": "notebook_with_decorative_cover",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d4.png?v7"
}, {
  "name": "notes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b6.png?v7"
}, {
  "name": "nut_and_bolt",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f529.png?v7"
}, {
  "name": "o",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b55.png?v7"
}, {
  "name": "o2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f17e.png?v7"
}, {
  "name": "ocean",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f30a.png?v7"
}, {
  "name": "octocat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/octocat.png?v7"
}, {
  "name": "octopus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f419.png?v7"
}, {
  "name": "oden",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f362.png?v7"
}, {
  "name": "office",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e2.png?v7"
}, {
  "name": "oil_drum",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e2.png?v7"
}, {
  "name": "ok",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f197.png?v7"
}, {
  "name": "ok_hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44c.png?v7"
}, {
  "name": "ok_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f646-2642.png?v7"
}, {
  "name": "ok_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f646.png?v7"
}, {
  "name": "old_key",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5dd.png?v7"
}, {
  "name": "older_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f474.png?v7"
}, {
  "name": "older_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f475.png?v7"
}, {
  "name": "om",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f549.png?v7"
}, {
  "name": "oman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f4-1f1f2.png?v7"
}, {
  "name": "on",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f51b.png?v7"
}, {
  "name": "oncoming_automobile",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f698.png?v7"
}, {
  "name": "oncoming_bus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f68d.png?v7"
}, {
  "name": "oncoming_police_car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f694.png?v7"
}, {
  "name": "oncoming_taxi",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f696.png?v7"
}, {
  "name": "one",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0031-20e3.png?v7"
}, {
  "name": "open_book",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d6.png?v7"
}, {
  "name": "open_file_folder",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c2.png?v7"
}, {
  "name": "open_hands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f450.png?v7"
}, {
  "name": "open_mouth",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f62e.png?v7"
}, {
  "name": "open_umbrella",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2602.png?v7"
}, {
  "name": "ophiuchus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26ce.png?v7"
}, {
  "name": "orange",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34a.png?v7"
}, {
  "name": "orange_book",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d9.png?v7"
}, {
  "name": "orthodox_cross",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2626.png?v7"
}, {
  "name": "outbox_tray",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e4.png?v7"
}, {
  "name": "owl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f989.png?v7"
}, {
  "name": "ox",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f402.png?v7"
}, {
  "name": "package",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e6.png?v7"
}, {
  "name": "page_facing_up",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c4.png?v7"
}, {
  "name": "page_with_curl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4c3.png?v7"
}, {
  "name": "pager",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4df.png?v7"
}, {
  "name": "paintbrush",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f58c.png?v7"
}, {
  "name": "pakistan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f0.png?v7"
}, {
  "name": "palau",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1fc.png?v7"
}, {
  "name": "palestinian_territories",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f8.png?v7"
}, {
  "name": "palm_tree",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f334.png?v7"
}, {
  "name": "panama",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1e6.png?v7"
}, {
  "name": "pancakes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f95e.png?v7"
}, {
  "name": "panda_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43c.png?v7"
}, {
  "name": "paperclip",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ce.png?v7"
}, {
  "name": "paperclips",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f587.png?v7"
}, {
  "name": "papua_new_guinea",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1ec.png?v7"
}, {
  "name": "paraguay",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1fe.png?v7"
}, {
  "name": "parasol_on_ground",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f1.png?v7"
}, {
  "name": "parking",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f17f.png?v7"
}, {
  "name": "part_alternation_mark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/303d.png?v7"
}, {
  "name": "partly_sunny",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26c5.png?v7"
}, {
  "name": "passenger_ship",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6f3.png?v7"
}, {
  "name": "passport_control",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6c2.png?v7"
}, {
  "name": "pause_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23f8.png?v7"
}, {
  "name": "paw_prints",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43e.png?v7"
}, {
  "name": "peace_symbol",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/262e.png?v7"
}, {
  "name": "peach",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f351.png?v7"
}, {
  "name": "peanuts",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f95c.png?v7"
}, {
  "name": "pear",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f350.png?v7"
}, {
  "name": "pen",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f58a.png?v7"
}, {
  "name": "pencil",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4dd.png?v7"
}, {
  "name": "pencil2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270f.png?v7"
}, {
  "name": "penguin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f427.png?v7"
}, {
  "name": "pensive",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f614.png?v7"
}, {
  "name": "performing_arts",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ad.png?v7"
}, {
  "name": "persevere",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f623.png?v7"
}, {
  "name": "person_fencing",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93a.png?v7"
}, {
  "name": "person_frowning",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64d.png?v7"
}, {
  "name": "person_with_blond_hair",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f471.png?v7"
}, {
  "name": "person_with_pouting_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64e.png?v7"
}, {
  "name": "peru",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1ea.png?v7"
}, {
  "name": "philippines",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1ed.png?v7"
}, {
  "name": "phone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/260e.png?v7"
}, {
  "name": "pick",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26cf.png?v7"
}, {
  "name": "pig",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f437.png?v7"
}, {
  "name": "pig2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f416.png?v7"
}, {
  "name": "pig_nose",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43d.png?v7"
}, {
  "name": "pill",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f48a.png?v7"
}, {
  "name": "pineapple",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34d.png?v7"
}, {
  "name": "ping_pong",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d3.png?v7"
}, {
  "name": "pisces",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2653.png?v7"
}, {
  "name": "pitcairn_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f3.png?v7"
}, {
  "name": "pizza",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f355.png?v7"
}, {
  "name": "place_of_worship",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6d0.png?v7"
}, {
  "name": "plate_with_cutlery",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f37d.png?v7"
}, {
  "name": "play_or_pause_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23ef.png?v7"
}, {
  "name": "point_down",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f447.png?v7"
}, {
  "name": "point_left",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f448.png?v7"
}, {
  "name": "point_right",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f449.png?v7"
}, {
  "name": "point_up",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/261d.png?v7"
}, {
  "name": "point_up_2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f446.png?v7"
}, {
  "name": "poland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f1.png?v7"
}, {
  "name": "police_car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f693.png?v7"
}, {
  "name": "policeman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46e.png?v7"
}, {
  "name": "policewoman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46e-2640.png?v7"
}, {
  "name": "poodle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f429.png?v7"
}, {
  "name": "poop",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a9.png?v7"
}, {
  "name": "popcorn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f37f.png?v7"
}, {
  "name": "portugal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f9.png?v7"
}, {
  "name": "post_office",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3e3.png?v7"
}, {
  "name": "postal_horn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ef.png?v7"
}, {
  "name": "postbox",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ee.png?v7"
}, {
  "name": "potable_water",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b0.png?v7"
}, {
  "name": "potato",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f954.png?v7"
}, {
  "name": "pouch",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45d.png?v7"
}, {
  "name": "poultry_leg",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f357.png?v7"
}, {
  "name": "pound",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b7.png?v7"
}, {
  "name": "pout",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f621.png?v7"
}, {
  "name": "pouting_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f63e.png?v7"
}, {
  "name": "pouting_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64e-2642.png?v7"
}, {
  "name": "pouting_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64e.png?v7"
}, {
  "name": "pray",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64f.png?v7"
}, {
  "name": "prayer_beads",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ff.png?v7"
}, {
  "name": "pregnant_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f930.png?v7"
}, {
  "name": "previous_track_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23ee.png?v7"
}, {
  "name": "prince",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f934.png?v7"
}, {
  "name": "princess",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f478.png?v7"
}, {
  "name": "printer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5a8.png?v7"
}, {
  "name": "puerto_rico",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f7.png?v7"
}, {
  "name": "punch",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44a.png?v7"
}, {
  "name": "purple_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f49c.png?v7"
}, {
  "name": "purse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45b.png?v7"
}, {
  "name": "pushpin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4cc.png?v7"
}, {
  "name": "put_litter_in_its_place",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ae.png?v7"
}, {
  "name": "qatar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f6-1f1e6.png?v7"
}, {
  "name": "question",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2753.png?v7"
}, {
  "name": "rabbit",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f430.png?v7"
}, {
  "name": "rabbit2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f407.png?v7"
}, {
  "name": "racehorse",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f40e.png?v7"
}, {
  "name": "racing_car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ce.png?v7"
}, {
  "name": "radio",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4fb.png?v7"
}, {
  "name": "radio_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f518.png?v7"
}, {
  "name": "radioactive",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2622.png?v7"
}, {
  "name": "rage",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f621.png?v7"
}, {
  "name": "rage1",
  "image": "https://assets-cdn.github.com/images/icons/emoji/rage1.png?v7"
}, {
  "name": "rage2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/rage2.png?v7"
}, {
  "name": "rage3",
  "image": "https://assets-cdn.github.com/images/icons/emoji/rage3.png?v7"
}, {
  "name": "rage4",
  "image": "https://assets-cdn.github.com/images/icons/emoji/rage4.png?v7"
}, {
  "name": "railway_car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f683.png?v7"
}, {
  "name": "railway_track",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e4.png?v7"
}, {
  "name": "rainbow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f308.png?v7"
}, {
  "name": "rainbow_flag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f3-1f308.png?v7"
}, {
  "name": "raised_back_of_hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f91a.png?v7"
}, {
  "name": "raised_hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270b.png?v7"
}, {
  "name": "raised_hand_with_fingers_splayed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f590.png?v7"
}, {
  "name": "raised_hands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64c.png?v7"
}, {
  "name": "raising_hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64b.png?v7"
}, {
  "name": "raising_hand_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64b-2642.png?v7"
}, {
  "name": "raising_hand_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64b.png?v7"
}, {
  "name": "ram",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f40f.png?v7"
}, {
  "name": "ramen",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f35c.png?v7"
}, {
  "name": "rat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f400.png?v7"
}, {
  "name": "record_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23fa.png?v7"
}, {
  "name": "recycle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/267b.png?v7"
}, {
  "name": "red_car",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f697.png?v7"
}, {
  "name": "red_circle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f534.png?v7"
}, {
  "name": "registered",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/00ae.png?v7"
}, {
  "name": "relaxed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/263a.png?v7"
}, {
  "name": "relieved",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f60c.png?v7"
}, {
  "name": "reminder_ribbon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f397.png?v7"
}, {
  "name": "repeat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f501.png?v7"
}, {
  "name": "repeat_one",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f502.png?v7"
}, {
  "name": "rescue_worker_helmet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26d1.png?v7"
}, {
  "name": "restroom",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6bb.png?v7"
}, {
  "name": "reunion",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f7-1f1ea.png?v7"
}, {
  "name": "revolving_hearts",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f49e.png?v7"
}, {
  "name": "rewind",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23ea.png?v7"
}, {
  "name": "rhinoceros",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f98f.png?v7"
}, {
  "name": "ribbon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f380.png?v7"
}, {
  "name": "rice",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f35a.png?v7"
}, {
  "name": "rice_ball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f359.png?v7"
}, {
  "name": "rice_cracker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f358.png?v7"
}, {
  "name": "rice_scene",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f391.png?v7"
}, {
  "name": "right_anger_bubble",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5ef.png?v7"
}, {
  "name": "ring",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f48d.png?v7"
}, {
  "name": "robot",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f916.png?v7"
}, {
  "name": "rocket",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f680.png?v7"
}, {
  "name": "rofl",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f923.png?v7"
}, {
  "name": "roll_eyes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f644.png?v7"
}, {
  "name": "roller_coaster",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a2.png?v7"
}, {
  "name": "romania",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f7-1f1f4.png?v7"
}, {
  "name": "rooster",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f413.png?v7"
}, {
  "name": "rose",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f339.png?v7"
}, {
  "name": "rosette",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f5.png?v7"
}, {
  "name": "rotating_light",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a8.png?v7"
}, {
  "name": "round_pushpin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4cd.png?v7"
}, {
  "name": "rowboat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a3.png?v7"
}, {
  "name": "rowing_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a3.png?v7"
}, {
  "name": "rowing_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a3-2640.png?v7"
}, {
  "name": "ru",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f7-1f1fa.png?v7"
}, {
  "name": "rugby_football",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c9.png?v7"
}, {
  "name": "runner",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c3.png?v7"
}, {
  "name": "running",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c3.png?v7"
}, {
  "name": "running_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c3.png?v7"
}, {
  "name": "running_shirt_with_sash",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3bd.png?v7"
}, {
  "name": "running_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c3-2640.png?v7"
}, {
  "name": "rwanda",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f7-1f1fc.png?v7"
}, {
  "name": "sa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f202.png?v7"
}, {
  "name": "sagittarius",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2650.png?v7"
}, {
  "name": "sailboat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f5.png?v7"
}, {
  "name": "sake",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f376.png?v7"
}, {
  "name": "samoa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fc-1f1f8.png?v7"
}, {
  "name": "san_marino",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f2.png?v7"
}, {
  "name": "sandal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f461.png?v7"
}, {
  "name": "santa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f385.png?v7"
}, {
  "name": "sao_tome_principe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f9.png?v7"
}, {
  "name": "satellite",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4e1.png?v7"
}, {
  "name": "satisfied",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f606.png?v7"
}, {
  "name": "saudi_arabia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1e6.png?v7"
}, {
  "name": "saxophone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b7.png?v7"
}, {
  "name": "school",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3eb.png?v7"
}, {
  "name": "school_satchel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f392.png?v7"
}, {
  "name": "scissors",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2702.png?v7"
}, {
  "name": "scorpion",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f982.png?v7"
}, {
  "name": "scorpius",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/264f.png?v7"
}, {
  "name": "scream",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f631.png?v7"
}, {
  "name": "scream_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f640.png?v7"
}, {
  "name": "scroll",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4dc.png?v7"
}, {
  "name": "seat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ba.png?v7"
}, {
  "name": "secret",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/3299.png?v7"
}, {
  "name": "see_no_evil",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f648.png?v7"
}, {
  "name": "seedling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f331.png?v7"
}, {
  "name": "selfie",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f933.png?v7"
}, {
  "name": "senegal",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f3.png?v7"
}, {
  "name": "serbia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f7-1f1f8.png?v7"
}, {
  "name": "seven",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0037-20e3.png?v7"
}, {
  "name": "seychelles",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1e8.png?v7"
}, {
  "name": "shallow_pan_of_food",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f958.png?v7"
}, {
  "name": "shamrock",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2618.png?v7"
}, {
  "name": "shark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f988.png?v7"
}, {
  "name": "shaved_ice",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f367.png?v7"
}, {
  "name": "sheep",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f411.png?v7"
}, {
  "name": "shell",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f41a.png?v7"
}, {
  "name": "shield",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e1.png?v7"
}, {
  "name": "shinto_shrine",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26e9.png?v7"
}, {
  "name": "ship",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a2.png?v7"
}, {
  "name": "shipit",
  "image": "https://assets-cdn.github.com/images/icons/emoji/shipit.png?v7"
}, {
  "name": "shirt",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f455.png?v7"
}, {
  "name": "shit",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a9.png?v7"
}, {
  "name": "shoe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45e.png?v7"
}, {
  "name": "shopping",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6cd.png?v7"
}, {
  "name": "shopping_cart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6d2.png?v7"
}, {
  "name": "shower",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6bf.png?v7"
}, {
  "name": "shrimp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f990.png?v7"
}, {
  "name": "sierra_leone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f1.png?v7"
}, {
  "name": "signal_strength",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f6.png?v7"
}, {
  "name": "singapore",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1ec.png?v7"
}, {
  "name": "sint_maarten",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1fd.png?v7"
}, {
  "name": "six",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0036-20e3.png?v7"
}, {
  "name": "six_pointed_star",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52f.png?v7"
}, {
  "name": "ski",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3bf.png?v7"
}, {
  "name": "skier",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26f7.png?v7"
}, {
  "name": "skull",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f480.png?v7"
}, {
  "name": "skull_and_crossbones",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2620.png?v7"
}, {
  "name": "sleeping",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f634.png?v7"
}, {
  "name": "sleeping_bed",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6cc.png?v7"
}, {
  "name": "sleepy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f62a.png?v7"
}, {
  "name": "slightly_frowning_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f641.png?v7"
}, {
  "name": "slightly_smiling_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f642.png?v7"
}, {
  "name": "slot_machine",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3b0.png?v7"
}, {
  "name": "slovakia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f0.png?v7"
}, {
  "name": "slovenia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1ee.png?v7"
}, {
  "name": "small_airplane",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6e9.png?v7"
}, {
  "name": "small_blue_diamond",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f539.png?v7"
}, {
  "name": "small_orange_diamond",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f538.png?v7"
}, {
  "name": "small_red_triangle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f53a.png?v7"
}, {
  "name": "small_red_triangle_down",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f53b.png?v7"
}, {
  "name": "smile",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f604.png?v7"
}, {
  "name": "smile_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f638.png?v7"
}, {
  "name": "smiley",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f603.png?v7"
}, {
  "name": "smiley_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f63a.png?v7"
}, {
  "name": "smiling_imp",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f608.png?v7"
}, {
  "name": "smirk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f60f.png?v7"
}, {
  "name": "smirk_cat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f63c.png?v7"
}, {
  "name": "smoking",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ac.png?v7"
}, {
  "name": "snail",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f40c.png?v7"
}, {
  "name": "snake",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f40d.png?v7"
}, {
  "name": "sneezing_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f927.png?v7"
}, {
  "name": "snowboarder",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c2.png?v7"
}, {
  "name": "snowflake",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2744.png?v7"
}, {
  "name": "snowman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26c4.png?v7"
}, {
  "name": "snowman_with_snow",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2603.png?v7"
}, {
  "name": "sob",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f62d.png?v7"
}, {
  "name": "soccer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26bd.png?v7"
}, {
  "name": "solomon_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1e7.png?v7"
}, {
  "name": "somalia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f4.png?v7"
}, {
  "name": "soon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f51c.png?v7"
}, {
  "name": "sos",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f198.png?v7"
}, {
  "name": "sound",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f509.png?v7"
}, {
  "name": "south_africa",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ff-1f1e6.png?v7"
}, {
  "name": "south_georgia_south_sandwich_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1f8.png?v7"
}, {
  "name": "south_sudan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f8.png?v7"
}, {
  "name": "space_invader",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f47e.png?v7"
}, {
  "name": "spades",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2660.png?v7"
}, {
  "name": "spaghetti",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f35d.png?v7"
}, {
  "name": "sparkle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2747.png?v7"
}, {
  "name": "sparkler",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f387.png?v7"
}, {
  "name": "sparkles",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2728.png?v7"
}, {
  "name": "sparkling_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f496.png?v7"
}, {
  "name": "speak_no_evil",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f64a.png?v7"
}, {
  "name": "speaker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f508.png?v7"
}, {
  "name": "speaking_head",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5e3.png?v7"
}, {
  "name": "speech_balloon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ac.png?v7"
}, {
  "name": "speedboat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a4.png?v7"
}, {
  "name": "spider",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f577.png?v7"
}, {
  "name": "spider_web",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f578.png?v7"
}, {
  "name": "spiral_calendar",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5d3.png?v7"
}, {
  "name": "spiral_notepad",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5d2.png?v7"
}, {
  "name": "spoon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f944.png?v7"
}, {
  "name": "squid",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f991.png?v7"
}, {
  "name": "squirrel",
  "image": "https://assets-cdn.github.com/images/icons/emoji/shipit.png?v7"
}, {
  "name": "sri_lanka",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1f0.png?v7"
}, {
  "name": "st_barthelemy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e7-1f1f1.png?v7"
}, {
  "name": "st_helena",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1ed.png?v7"
}, {
  "name": "st_kitts_nevis",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f0-1f1f3.png?v7"
}, {
  "name": "st_lucia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f1-1f1e8.png?v7"
}, {
  "name": "st_pierre_miquelon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f5-1f1f2.png?v7"
}, {
  "name": "st_vincent_grenadines",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1e8.png?v7"
}, {
  "name": "stadium",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3df.png?v7"
}, {
  "name": "star",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b50.png?v7"
}, {
  "name": "star2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f31f.png?v7"
}, {
  "name": "star_and_crescent",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/262a.png?v7"
}, {
  "name": "star_of_david",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2721.png?v7"
}, {
  "name": "stars",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f320.png?v7"
}, {
  "name": "station",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f689.png?v7"
}, {
  "name": "statue_of_liberty",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5fd.png?v7"
}, {
  "name": "steam_locomotive",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f682.png?v7"
}, {
  "name": "stew",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f372.png?v7"
}, {
  "name": "stop_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23f9.png?v7"
}, {
  "name": "stop_sign",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6d1.png?v7"
}, {
  "name": "stopwatch",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23f1.png?v7"
}, {
  "name": "straight_ruler",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4cf.png?v7"
}, {
  "name": "strawberry",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f353.png?v7"
}, {
  "name": "stuck_out_tongue",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f61b.png?v7"
}, {
  "name": "stuck_out_tongue_closed_eyes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f61d.png?v7"
}, {
  "name": "stuck_out_tongue_winking_eye",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f61c.png?v7"
}, {
  "name": "studio_microphone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f399.png?v7"
}, {
  "name": "stuffed_flatbread",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f959.png?v7"
}, {
  "name": "sudan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1e9.png?v7"
}, {
  "name": "sun_behind_large_cloud",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f325.png?v7"
}, {
  "name": "sun_behind_rain_cloud",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f326.png?v7"
}, {
  "name": "sun_behind_small_cloud",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f324.png?v7"
}, {
  "name": "sun_with_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f31e.png?v7"
}, {
  "name": "sunflower",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f33b.png?v7"
}, {
  "name": "sunglasses",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f60e.png?v7"
}, {
  "name": "sunny",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2600.png?v7"
}, {
  "name": "sunrise",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f305.png?v7"
}, {
  "name": "sunrise_over_mountains",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f304.png?v7"
}, {
  "name": "surfer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c4.png?v7"
}, {
  "name": "surfing_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c4.png?v7"
}, {
  "name": "surfing_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c4-2640.png?v7"
}, {
  "name": "suriname",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1f7.png?v7"
}, {
  "name": "sushi",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f363.png?v7"
}, {
  "name": "suspect",
  "image": "https://assets-cdn.github.com/images/icons/emoji/suspect.png?v7"
}, {
  "name": "suspension_railway",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f69f.png?v7"
}, {
  "name": "swaziland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1ff.png?v7"
}, {
  "name": "sweat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f613.png?v7"
}, {
  "name": "sweat_drops",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a6.png?v7"
}, {
  "name": "sweat_smile",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f605.png?v7"
}, {
  "name": "sweden",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1ea.png?v7"
}, {
  "name": "sweet_potato",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f360.png?v7"
}, {
  "name": "swimmer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ca.png?v7"
}, {
  "name": "swimming_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ca.png?v7"
}, {
  "name": "swimming_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ca-2640.png?v7"
}, {
  "name": "switzerland",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e8-1f1ed.png?v7"
}, {
  "name": "symbols",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f523.png?v7"
}, {
  "name": "synagogue",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f54d.png?v7"
}, {
  "name": "syria",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f8-1f1fe.png?v7"
}, {
  "name": "syringe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f489.png?v7"
}, {
  "name": "taco",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f32e.png?v7"
}, {
  "name": "tada",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f389.png?v7"
}, {
  "name": "taiwan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1fc.png?v7"
}, {
  "name": "tajikistan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1ef.png?v7"
}, {
  "name": "tanabata_tree",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f38b.png?v7"
}, {
  "name": "tangerine",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f34a.png?v7"
}, {
  "name": "tanzania",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1ff.png?v7"
}, {
  "name": "taurus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2649.png?v7"
}, {
  "name": "taxi",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f695.png?v7"
}, {
  "name": "tea",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f375.png?v7"
}, {
  "name": "telephone",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/260e.png?v7"
}, {
  "name": "telephone_receiver",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4de.png?v7"
}, {
  "name": "telescope",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f52d.png?v7"
}, {
  "name": "tennis",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3be.png?v7"
}, {
  "name": "tent",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26fa.png?v7"
}, {
  "name": "thailand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1ed.png?v7"
}, {
  "name": "thermometer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f321.png?v7"
}, {
  "name": "thinking",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f914.png?v7"
}, {
  "name": "thought_balloon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ad.png?v7"
}, {
  "name": "three",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0033-20e3.png?v7"
}, {
  "name": "thumbsdown",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44e.png?v7"
}, {
  "name": "thumbsup",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44d.png?v7"
}, {
  "name": "ticket",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ab.png?v7"
}, {
  "name": "tickets",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f39f.png?v7"
}, {
  "name": "tiger",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f42f.png?v7"
}, {
  "name": "tiger2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f405.png?v7"
}, {
  "name": "timer_clock",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/23f2.png?v7"
}, {
  "name": "timor_leste",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f1.png?v7"
}, {
  "name": "tipping_hand_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f481-2642.png?v7"
}, {
  "name": "tipping_hand_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f481.png?v7"
}, {
  "name": "tired_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f62b.png?v7"
}, {
  "name": "tm",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2122.png?v7"
}, {
  "name": "togo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1ec.png?v7"
}, {
  "name": "toilet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6bd.png?v7"
}, {
  "name": "tokelau",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f0.png?v7"
}, {
  "name": "tokyo_tower",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5fc.png?v7"
}, {
  "name": "tomato",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f345.png?v7"
}, {
  "name": "tonga",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f4.png?v7"
}, {
  "name": "tongue",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f445.png?v7"
}, {
  "name": "top",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f51d.png?v7"
}, {
  "name": "tophat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3a9.png?v7"
}, {
  "name": "tornado",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f32a.png?v7"
}, {
  "name": "tr",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f7.png?v7"
}, {
  "name": "trackball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5b2.png?v7"
}, {
  "name": "tractor",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f69c.png?v7"
}, {
  "name": "traffic_light",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a5.png?v7"
}, {
  "name": "train",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f68b.png?v7"
}, {
  "name": "train2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f686.png?v7"
}, {
  "name": "tram",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f68a.png?v7"
}, {
  "name": "triangular_flag_on_post",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a9.png?v7"
}, {
  "name": "triangular_ruler",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4d0.png?v7"
}, {
  "name": "trident",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f531.png?v7"
}, {
  "name": "trinidad_tobago",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f9.png?v7"
}, {
  "name": "triumph",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f624.png?v7"
}, {
  "name": "trolleybus",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f68e.png?v7"
}, {
  "name": "trollface",
  "image": "https://assets-cdn.github.com/images/icons/emoji/trollface.png?v7"
}, {
  "name": "trophy",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3c6.png?v7"
}, {
  "name": "tropical_drink",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f379.png?v7"
}, {
  "name": "tropical_fish",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f420.png?v7"
}, {
  "name": "truck",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f69a.png?v7"
}, {
  "name": "trumpet",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ba.png?v7"
}, {
  "name": "tshirt",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f455.png?v7"
}, {
  "name": "tulip",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f337.png?v7"
}, {
  "name": "tumbler_glass",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f943.png?v7"
}, {
  "name": "tunisia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f3.png?v7"
}, {
  "name": "turkey",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f983.png?v7"
}, {
  "name": "turkmenistan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1f2.png?v7"
}, {
  "name": "turks_caicos_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1e8.png?v7"
}, {
  "name": "turtle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f422.png?v7"
}, {
  "name": "tuvalu",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1f9-1f1fb.png?v7"
}, {
  "name": "tv",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4fa.png?v7"
}, {
  "name": "twisted_rightwards_arrows",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f500.png?v7"
}, {
  "name": "two",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0032-20e3.png?v7"
}, {
  "name": "two_hearts",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f495.png?v7"
}, {
  "name": "two_men_holding_hands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46c.png?v7"
}, {
  "name": "two_women_holding_hands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f46d.png?v7"
}, {
  "name": "u5272",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f239.png?v7"
}, {
  "name": "u5408",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f234.png?v7"
}, {
  "name": "u55b6",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f23a.png?v7"
}, {
  "name": "u6307",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f22f.png?v7"
}, {
  "name": "u6708",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f237.png?v7"
}, {
  "name": "u6709",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f236.png?v7"
}, {
  "name": "u6e80",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f235.png?v7"
}, {
  "name": "u7121",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f21a.png?v7"
}, {
  "name": "u7533",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f238.png?v7"
}, {
  "name": "u7981",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f232.png?v7"
}, {
  "name": "u7a7a",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f233.png?v7"
}, {
  "name": "uganda",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fa-1f1ec.png?v7"
}, {
  "name": "uk",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ec-1f1e7.png?v7"
}, {
  "name": "ukraine",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fa-1f1e6.png?v7"
}, {
  "name": "umbrella",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2614.png?v7"
}, {
  "name": "unamused",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f612.png?v7"
}, {
  "name": "underage",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f51e.png?v7"
}, {
  "name": "unicorn",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f984.png?v7"
}, {
  "name": "united_arab_emirates",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1e6-1f1ea.png?v7"
}, {
  "name": "unlock",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f513.png?v7"
}, {
  "name": "up",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f199.png?v7"
}, {
  "name": "upside_down_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f643.png?v7"
}, {
  "name": "uruguay",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fa-1f1fe.png?v7"
}, {
  "name": "us",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fa-1f1f8.png?v7"
}, {
  "name": "us_virgin_islands",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1ee.png?v7"
}, {
  "name": "uzbekistan",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fa-1f1ff.png?v7"
}, {
  "name": "v",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270c.png?v7"
}, {
  "name": "vanuatu",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1fa.png?v7"
}, {
  "name": "vatican_city",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1e6.png?v7"
}, {
  "name": "venezuela",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1ea.png?v7"
}, {
  "name": "vertical_traffic_light",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6a6.png?v7"
}, {
  "name": "vhs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4fc.png?v7"
}, {
  "name": "vibration_mode",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f3.png?v7"
}, {
  "name": "video_camera",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4f9.png?v7"
}, {
  "name": "video_game",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3ae.png?v7"
}, {
  "name": "vietnam",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fb-1f1f3.png?v7"
}, {
  "name": "violin",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3bb.png?v7"
}, {
  "name": "virgo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/264d.png?v7"
}, {
  "name": "volcano",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f30b.png?v7"
}, {
  "name": "volleyball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3d0.png?v7"
}, {
  "name": "vs",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f19a.png?v7"
}, {
  "name": "vulcan_salute",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f596.png?v7"
}, {
  "name": "walking",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b6.png?v7"
}, {
  "name": "walking_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b6.png?v7"
}, {
  "name": "walking_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6b6-2640.png?v7"
}, {
  "name": "wallis_futuna",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fc-1f1eb.png?v7"
}, {
  "name": "waning_crescent_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f318.png?v7"
}, {
  "name": "waning_gibbous_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f316.png?v7"
}, {
  "name": "warning",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26a0.png?v7"
}, {
  "name": "wastebasket",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5d1.png?v7"
}, {
  "name": "watch",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/231a.png?v7"
}, {
  "name": "water_buffalo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f403.png?v7"
}, {
  "name": "watermelon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f349.png?v7"
}, {
  "name": "wave",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f44b.png?v7"
}, {
  "name": "wavy_dash",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/3030.png?v7"
}, {
  "name": "waxing_crescent_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f312.png?v7"
}, {
  "name": "waxing_gibbous_moon",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f314.png?v7"
}, {
  "name": "wc",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6be.png?v7"
}, {
  "name": "weary",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f629.png?v7"
}, {
  "name": "wedding",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f492.png?v7"
}, {
  "name": "weight_lifting_man",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3cb.png?v7"
}, {
  "name": "weight_lifting_woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3cb-2640.png?v7"
}, {
  "name": "western_sahara",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ea-1f1ed.png?v7"
}, {
  "name": "whale",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f433.png?v7"
}, {
  "name": "whale2",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f40b.png?v7"
}, {
  "name": "wheel_of_dharma",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2638.png?v7"
}, {
  "name": "wheelchair",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/267f.png?v7"
}, {
  "name": "white_check_mark",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2705.png?v7"
}, {
  "name": "white_circle",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26aa.png?v7"
}, {
  "name": "white_flag",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f3f3.png?v7"
}, {
  "name": "white_flower",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4ae.png?v7"
}, {
  "name": "white_large_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/2b1c.png?v7"
}, {
  "name": "white_medium_small_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25fd.png?v7"
}, {
  "name": "white_medium_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25fb.png?v7"
}, {
  "name": "white_small_square",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/25ab.png?v7"
}, {
  "name": "white_square_button",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f533.png?v7"
}, {
  "name": "wilted_flower",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f940.png?v7"
}, {
  "name": "wind_chime",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f390.png?v7"
}, {
  "name": "wind_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f32c.png?v7"
}, {
  "name": "wine_glass",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f377.png?v7"
}, {
  "name": "wink",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f609.png?v7"
}, {
  "name": "wolf",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f43a.png?v7"
}, {
  "name": "woman",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469.png?v7"
}, {
  "name": "woman_artist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f3a8.png?v7"
}, {
  "name": "woman_astronaut",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f680.png?v7"
}, {
  "name": "woman_cartwheeling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f938-2640.png?v7"
}, {
  "name": "woman_cook",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f373.png?v7"
}, {
  "name": "woman_facepalming",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f926-2640.png?v7"
}, {
  "name": "woman_factory_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f3ed.png?v7"
}, {
  "name": "woman_farmer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f33e.png?v7"
}, {
  "name": "woman_firefighter",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f692.png?v7"
}, {
  "name": "woman_health_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-2695.png?v7"
}, {
  "name": "woman_judge",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-2696.png?v7"
}, {
  "name": "woman_juggling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f939-2640.png?v7"
}, {
  "name": "woman_mechanic",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f527.png?v7"
}, {
  "name": "woman_office_worker",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f4bc.png?v7"
}, {
  "name": "woman_pilot",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-2708.png?v7"
}, {
  "name": "woman_playing_handball",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93e-2640.png?v7"
}, {
  "name": "woman_playing_water_polo",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93d-2640.png?v7"
}, {
  "name": "woman_scientist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f52c.png?v7"
}, {
  "name": "woman_shrugging",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f937-2640.png?v7"
}, {
  "name": "woman_singer",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f3a4.png?v7"
}, {
  "name": "woman_student",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f393.png?v7"
}, {
  "name": "woman_teacher",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f3eb.png?v7"
}, {
  "name": "woman_technologist",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f469-1f4bb.png?v7"
}, {
  "name": "woman_with_turban",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f473-2640.png?v7"
}, {
  "name": "womans_clothes",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f45a.png?v7"
}, {
  "name": "womans_hat",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f452.png?v7"
}, {
  "name": "women_wrestling",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f93c-2640.png?v7"
}, {
  "name": "womens",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f6ba.png?v7"
}, {
  "name": "world_map",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f5fa.png?v7"
}, {
  "name": "worried",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f61f.png?v7"
}, {
  "name": "wrench",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f527.png?v7"
}, {
  "name": "writing_hand",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/270d.png?v7"
}, {
  "name": "x",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/274c.png?v7"
}, {
  "name": "yellow_heart",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f49b.png?v7"
}, {
  "name": "yemen",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1fe-1f1ea.png?v7"
}, {
  "name": "yen",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4b4.png?v7"
}, {
  "name": "yin_yang",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/262f.png?v7"
}, {
  "name": "yum",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f60b.png?v7"
}, {
  "name": "zambia",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ff-1f1f2.png?v7"
}, {
  "name": "zap",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/26a1.png?v7"
}, {
  "name": "zero",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/0030-20e3.png?v7"
}, {
  "name": "zimbabwe",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f1ff-1f1fc.png?v7"
}, {
  "name": "zipper_mouth_face",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f910.png?v7"
}, {
  "name": "zzz",
  "image": "https://assets-cdn.github.com/images/icons/emoji/unicode/1f4a4.png?v7"
}];

const compareNumbers = (a, b) => {
  if (a === b) return 0;
  if (a > b) return 1;
  return -1;
};

const filterItems = (items, query) => {
  if (query.length === 0) {
    return items;
  }

  const normalizedQuery = query.trim().toLowerCase();

  return items.map((_ref) => {
    let name = _ref.name,
        rest = objectWithoutProperties(_ref, ['name']);
    return _extends({ name, sorting: name.indexOf(normalizedQuery) }, rest);
  }).filter((_ref2) => {
    let sorting = _ref2.sorting;
    return sorting !== -1;
  }).sort((a, b) => compareNumbers(a.sorting, b.sorting));
};

class EmojiApp extends Component {
  constructor() {
    super();

    this.state.query = '';
  }

  render(_ref3, _ref4) {
    let query = _ref4.query;
    objectDestructuringEmpty(_ref3);

    return h(
      'main',
      { 'class': 'page-wrap' },
      h(EmojiSearch, { onSearch: query => this.setState({ query }) }),
      h(EmojiList, { items: filterItems(emojis, query) })
    );
  }
}

render(h(EmojiApp, null), document.body);

}());
//# sourceMappingURL=emoji.js.map
