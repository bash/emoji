(function () {
	'use strict';

	var VNode = function VNode() {};

	var options = {};
	var stack = [];
	var EMPTY_CHILDREN = [];

	function h(nodeName, attributes) {
	  var children = EMPTY_CHILDREN,
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
	      for (i = child.length; i--;) {
	        stack.push(child[i]);
	      }
	    } else {
	      if (typeof child === 'boolean') child = null;

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

	  var p = new VNode();
	  p.nodeName = nodeName;
	  p.children = children;
	  p.attributes = attributes == null ? undefined : attributes;
	  p.key = attributes == null ? undefined : attributes.key;
	  return p;
	}

	function extend(obj, props) {
	  for (var i in props) {
	    obj[i] = props[i];
	  }

	  return obj;
	}

	function applyRef(ref, value) {
	  if (ref != null) {
	    if (typeof ref == 'function') ref(value);else ref.current = value;
	  }
	}

	var defer = typeof Promise == 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;

	var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;
	var items = [];

	function enqueueRender(component) {
	  if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
	    (defer)(rerender);
	  }
	}

	function rerender() {
	  var p;

	  while (p = items.pop()) {
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
	  var props = extend({}, vnode.attributes);
	  props.children = vnode.children;
	  var defaultProps = vnode.nodeName.defaultProps;

	  if (defaultProps !== undefined) {
	    for (var i in defaultProps) {
	      if (props[i] === undefined) {
	        props[i] = defaultProps[i];
	      }
	    }
	  }

	  return props;
	}

	function createNode(nodeName, isSvg) {
	  var node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	  node.normalizedNodeName = nodeName;
	  return node;
	}

	function removeNode(node) {
	  var parentNode = node.parentNode;
	  if (parentNode) parentNode.removeChild(node);
	}

	function setAccessor(node, name, old, value, isSvg) {
	  if (name === 'className') name = 'class';

	  if (name === 'key') ; else if (name === 'ref') {
	    applyRef(old, null);
	    applyRef(value, node);
	  } else if (name === 'class' && !isSvg) {
	    node.className = value || '';
	  } else if (name === 'style') {
	    if (!value || typeof value === 'string' || typeof old === 'string') {
	      node.style.cssText = value || '';
	    }

	    if (value && typeof value === 'object') {
	      if (typeof old !== 'string') {
	        for (var i in old) {
	          if (!(i in value)) node.style[i] = '';
	        }
	      }

	      for (var i in value) {
	        node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
	      }
	    }
	  } else if (name === 'dangerouslySetInnerHTML') {
	    if (value) node.innerHTML = value.__html || '';
	  } else if (name[0] == 'o' && name[1] == 'n') {
	    var useCapture = name !== (name = name.replace(/Capture$/, ''));
	    name = name.toLowerCase().substring(2);

	    if (value) {
	      if (!old) node.addEventListener(name, eventProxy, useCapture);
	    } else {
	      node.removeEventListener(name, eventProxy, useCapture);
	    }

	    (node._listeners || (node._listeners = {}))[name] = value;
	  } else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
	    try {
	      node[name] = value == null ? '' : value;
	    } catch (e) {}

	    if ((value == null || value === false) && name != 'spellcheck') node.removeAttribute(name);
	  } else {
	    var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ''));

	    if (value == null || value === false) {
	      if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
	    } else if (typeof value !== 'function') {
	      if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
	    }
	  }
	}

	function eventProxy(e) {
	  return this._listeners[e.type](e);
	}

	var mounts = [];
	var diffLevel = 0;
	var isSvgMode = false;
	var hydrating = false;

	function flushMounts() {
	  var c;

	  while (c = mounts.shift()) {
	    if (c.componentDidMount) c.componentDidMount();
	  }
	}

	function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	  if (!diffLevel++) {
	    isSvgMode = parent != null && parent.ownerSVGElement !== undefined;
	    hydrating = dom != null && !('__preactattr_' in dom);
	  }

	  var ret = idiff(dom, vnode, context, mountAll, componentRoot);
	  if (parent && ret.parentNode !== parent) parent.appendChild(ret);

	  if (! --diffLevel) {
	    hydrating = false;
	    if (!componentRoot) flushMounts();
	  }

	  return ret;
	}

	function idiff(dom, vnode, context, mountAll, componentRoot) {
	  var out = dom,
	      prevSvgMode = isSvgMode;
	  if (vnode == null || typeof vnode === 'boolean') vnode = '';

	  if (typeof vnode === 'string' || typeof vnode === 'number') {
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

	    out['__preactattr_'] = true;
	    return out;
	  }

	  var vnodeName = vnode.nodeName;

	  if (typeof vnodeName === 'function') {
	    return buildComponentFromVNode(dom, vnode, context, mountAll);
	  }

	  isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;
	  vnodeName = String(vnodeName);

	  if (!dom || !isNamedNode(dom, vnodeName)) {
	    out = createNode(vnodeName, isSvgMode);

	    if (dom) {
	      while (dom.firstChild) {
	        out.appendChild(dom.firstChild);
	      }

	      if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
	      recollectNodeTree(dom, true);
	    }
	  }

	  var fc = out.firstChild,
	      props = out['__preactattr_'],
	      vchildren = vnode.children;

	  if (props == null) {
	    props = out['__preactattr_'] = {};

	    for (var a = out.attributes, i = a.length; i--;) {
	      props[a[i].name] = a[i].value;
	    }
	  }

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
	  var originalChildren = dom.childNodes,
	      children = [],
	      keyed = {},
	      keyedLen = 0,
	      min = 0,
	      len = originalChildren.length,
	      childrenLen = 0,
	      vlen = vchildren ? vchildren.length : 0,
	      j,
	      c,
	      f,
	      vchild,
	      child;

	  if (len !== 0) {
	    for (var i = 0; i < len; i++) {
	      var _child = originalChildren[i],
	          props = _child['__preactattr_'],
	          key = vlen && props ? _child._component ? _child._component.__key : props.key : null;

	      if (key != null) {
	        keyedLen++;
	        keyed[key] = _child;
	      } else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
	        children[childrenLen++] = _child;
	      }
	    }
	  }

	  if (vlen !== 0) {
	    for (var i = 0; i < vlen; i++) {
	      vchild = vchildren[i];
	      child = null;
	      var key = vchild.key;

	      if (key != null) {
	        if (keyedLen && keyed[key] !== undefined) {
	          child = keyed[key];
	          keyed[key] = undefined;
	          keyedLen--;
	        }
	      } else if (min < childrenLen) {
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
	      f = originalChildren[i];

	      if (child && child !== dom && child !== f) {
	        if (f == null) {
	          dom.appendChild(child);
	        } else if (child === f.nextSibling) {
	          removeNode(f);
	        } else {
	          dom.insertBefore(child, f);
	        }
	      }
	    }
	  }

	  if (keyedLen) {
	    for (var i in keyed) {
	      if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
	    }
	  }

	  while (min <= childrenLen) {
	    if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
	  }
	}

	function recollectNodeTree(node, unmountOnly) {
	  var component = node._component;

	  if (component) {
	    unmountComponent(component);
	  } else {
	    if (node['__preactattr_'] != null) applyRef(node['__preactattr_'].ref, null);

	    if (unmountOnly === false || node['__preactattr_'] == null) {
	      removeNode(node);
	    }

	    removeChildren(node);
	  }
	}

	function removeChildren(node) {
	  node = node.lastChild;

	  while (node) {
	    var next = node.previousSibling;
	    recollectNodeTree(node, true);
	    node = next;
	  }
	}

	function diffAttributes(dom, attrs, old) {
	  var name;

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

	var recyclerComponents = [];

	function createComponent(Ctor, props, context) {
	  var inst,
	      i = recyclerComponents.length;

	  if (Ctor.prototype && Ctor.prototype.render) {
	    inst = new Ctor(props, context);
	    Component.call(inst, props, context);
	  } else {
	    inst = new Component(props, context);
	    inst.constructor = Ctor;
	    inst.render = doRender;
	  }

	  while (i--) {
	    if (recyclerComponents[i].constructor === Ctor) {
	      inst.nextBase = recyclerComponents[i].nextBase;
	      recyclerComponents.splice(i, 1);
	      return inst;
	    }
	  }

	  return inst;
	}

	function doRender(props, state, context) {
	  return this.constructor(props, context);
	}

	function setComponentProps(component, props, renderMode, context, mountAll) {
	  if (component._disable) return;
	  component._disable = true;
	  component.__ref = props.ref;
	  component.__key = props.key;
	  delete props.ref;
	  delete props.key;

	  if (typeof component.constructor.getDerivedStateFromProps === 'undefined') {
	    if (!component.base || mountAll) {
	      if (component.componentWillMount) component.componentWillMount();
	    } else if (component.componentWillReceiveProps) {
	      component.componentWillReceiveProps(props, context);
	    }
	  }

	  if (context && context !== component.context) {
	    if (!component.prevContext) component.prevContext = component.context;
	    component.context = context;
	  }

	  if (!component.prevProps) component.prevProps = component.props;
	  component.props = props;
	  component._disable = false;

	  if (renderMode !== 0) {
	    if (renderMode === 1 || options.syncComponentUpdates !== false || !component.base) {
	      renderComponent(component, 1, mountAll);
	    } else {
	      enqueueRender(component);
	    }
	  }

	  applyRef(component.__ref, component);
	}

	function renderComponent(component, renderMode, mountAll, isChild) {
	  if (component._disable) return;
	  var props = component.props,
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
	      snapshot = previousContext,
	      rendered,
	      inst,
	      cbase;

	  if (component.constructor.getDerivedStateFromProps) {
	    state = extend(extend({}, state), component.constructor.getDerivedStateFromProps(props, state));
	    component.state = state;
	  }

	  if (isUpdate) {
	    component.props = previousProps;
	    component.state = previousState;
	    component.context = previousContext;

	    if (renderMode !== 2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
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

	    if (isUpdate && component.getSnapshotBeforeUpdate) {
	      snapshot = component.getSnapshotBeforeUpdate(previousProps, previousState);
	    }

	    var childComponent = rendered && rendered.nodeName,
	        toUnmount,
	        base;

	    if (typeof childComponent === 'function') {
	      var childProps = getNodeProps(rendered);
	      inst = initialChildComponent;

	      if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
	        setComponentProps(inst, childProps, 1, context, false);
	      } else {
	        toUnmount = inst;
	        component._component = inst = createComponent(childComponent, childProps, context);
	        inst.nextBase = inst.nextBase || nextBase;
	        inst._parentComponent = component;
	        setComponentProps(inst, childProps, 0, context, false);
	        renderComponent(inst, 1, mountAll, true);
	      }

	      base = inst.base;
	    } else {
	      cbase = initialBase;
	      toUnmount = initialChildComponent;

	      if (toUnmount) {
	        cbase = component._component = null;
	      }

	      if (initialBase || renderMode === 1) {
	        if (cbase) cbase._component = null;
	        base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
	      }
	    }

	    if (initialBase && base !== initialBase && inst !== initialChildComponent) {
	      var baseParent = initialBase.parentNode;

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
	      var componentRef = component,
	          t = component;

	      while (t = t._parentComponent) {
	        (componentRef = t).base = base;
	      }

	      base._component = componentRef;
	      base._componentConstructor = componentRef.constructor;
	    }
	  }

	  if (!isUpdate || mountAll) {
	    mounts.push(component);
	  } else if (!skip) {
	    if (component.componentDidUpdate) {
	      component.componentDidUpdate(previousProps, previousState, snapshot);
	    }
	  }

	  while (component._renderCallbacks.length) {
	    component._renderCallbacks.pop().call(component);
	  }

	  if (!diffLevel && !isChild) flushMounts();
	}

	function buildComponentFromVNode(dom, vnode, context, mountAll) {
	  var c = dom && dom._component,
	      originalComponent = c,
	      oldDom = dom,
	      isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
	      isOwner = isDirectOwner,
	      props = getNodeProps(vnode);

	  while (c && !isOwner && (c = c._parentComponent)) {
	    isOwner = c.constructor === vnode.nodeName;
	  }

	  if (c && isOwner && (!mountAll || c._component)) {
	    setComponentProps(c, props, 3, context, mountAll);
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

	    setComponentProps(c, props, 1, context, mountAll);
	    dom = c.base;

	    if (oldDom && dom !== oldDom) {
	      oldDom._component = null;
	      recollectNodeTree(oldDom, false);
	    }
	  }

	  return dom;
	}

	function unmountComponent(component) {
	  var base = component.base;
	  component._disable = true;
	  if (component.componentWillUnmount) component.componentWillUnmount();
	  component.base = null;
	  var inner = component._component;

	  if (inner) {
	    unmountComponent(inner);
	  } else if (base) {
	    if (base['__preactattr_'] != null) applyRef(base['__preactattr_'].ref, null);
	    component.nextBase = base;
	    removeNode(base);
	    recyclerComponents.push(component);
	    removeChildren(base);
	  }

	  applyRef(component.__ref, null);
	}

	function Component(props, context) {
	  this._dirty = true;
	  this.context = context;
	  this.props = props;
	  this.state = this.state || {};
	  this._renderCallbacks = [];
	}

	extend(Component.prototype, {
	  setState: function setState(state, callback) {
	    if (!this.prevState) this.prevState = this.state;
	    this.state = extend(extend({}, this.state), typeof state === 'function' ? state(this.state, this.props) : state);
	    if (callback) this._renderCallbacks.push(callback);
	    enqueueRender(this);
	  },
	  forceUpdate: function forceUpdate(callback) {
	    if (callback) this._renderCallbacks.push(callback);
	    renderComponent(this, 2);
	  },
	  render: function render() {}
	});

	function render(vnode, parent, merge) {
	  return diff(merge, vnode, {}, false, parent, false);
	}

	function _defineProperty(obj, key, value) {
	  if (key in obj) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	  } else {
	    obj[key] = value;
	  }

	  return obj;
	}

	function _extends() {
	  _extends = Object.assign || function (target) {
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

	  return _extends.apply(this, arguments);
	}

	function _objectSpread(target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i] != null ? arguments[i] : {};
	    var ownKeys = Object.keys(source);

	    if (typeof Object.getOwnPropertySymbols === 'function') {
	      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
	        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
	      }));
	    }

	    ownKeys.forEach(function (key) {
	      _defineProperty(target, key, source[key]);
	    });
	  }

	  return target;
	}

	function _objectWithoutPropertiesLoose(source, excluded) {
	  if (source == null) return {};
	  var target = {};
	  var sourceKeys = Object.keys(source);
	  var key, i;

	  for (i = 0; i < sourceKeys.length; i++) {
	    key = sourceKeys[i];
	    if (excluded.indexOf(key) >= 0) continue;
	    target[key] = source[key];
	  }

	  return target;
	}

	function _objectWithoutProperties(source, excluded) {
	  if (source == null) return {};

	  var target = _objectWithoutPropertiesLoose(source, excluded);

	  var key, i;

	  if (Object.getOwnPropertySymbols) {
	    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

	    for (i = 0; i < sourceSymbolKeys.length; i++) {
	      key = sourceSymbolKeys[i];
	      if (excluded.indexOf(key) >= 0) continue;
	      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
	      target[key] = source[key];
	    }
	  }

	  return target;
	}

	const EmojiSearch = (_ref) => {
	  let {
	    onSearch
	  } = _ref;
	  return h("div", {
	    class: "search-container"
	  }, h("input", {
	    type: "search",
	    class: "emoji-search",
	    placeholder: "Type to search ...",
	    onInput: event => onSearch(event.target.value)
	  }));
	};

	class Image extends Component {
	  constructor() {
	    super();

	    _defineProperty(this, "_observerCallback", (entries, observer) => {
	      if (entries[0].intersectionRatio <= 0) {
	        return;
	      }

	      observer.disconnect();
	      this.setState({
	        loaded: true
	      });
	    });

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
	    let {
	      loaded
	    } = _ref2;

	    let {
	      src,
	      preview
	    } = _ref,
	        props = _objectWithoutProperties(_ref, ["src", "preview"]);

	    const _src = loaded ? src : preview;

	    return h("img", _extends({
	      src: _src,
	      ref: image => this._observe(image)
	    }, props));
	  }

	}

	const FALLBACK_IMAGE = 'https://github.githubassets.com/images/icons/emoji/unicode/2753.png';
	const EmojiItem = (_ref) => {
	  let {
	    name,
	    image
	  } = _ref;
	  return h("div", {
	    class: "emoji-item"
	  }, h(Image, {
	    src: image,
	    preview: FALLBACK_IMAGE,
	    alt: name,
	    class: "image"
	  }), h("span", null, ":", name, ":"));
	};

	const EmojiList = (_ref) => {
	  let {
	    items
	  } = _ref;
	  return h("div", {
	    class: "emoji-list"
	  }, items.map((_ref2) => {
	    let {
	      name,
	      image
	    } = _ref2;
	    return h(EmojiItem, {
	      name: name,
	      image: image
	    });
	  }));
	};

	const emojis = [{
	  "name": "100",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4af.png?v8"
	}, {
	  "name": "1234",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f522.png?v8"
	}, {
	  "name": "+1",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44d.png?v8"
	}, {
	  "name": "-1",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44e.png?v8"
	}, {
	  "name": "1st_place_medal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f947.png?v8"
	}, {
	  "name": "2nd_place_medal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f948.png?v8"
	}, {
	  "name": "3rd_place_medal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f949.png?v8"
	}, {
	  "name": "8ball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b1.png?v8"
	}, {
	  "name": "a",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f170.png?v8"
	}, {
	  "name": "ab",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f18e.png?v8"
	}, {
	  "name": "abc",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f524.png?v8"
	}, {
	  "name": "abcd",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f521.png?v8"
	}, {
	  "name": "accept",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f251.png?v8"
	}, {
	  "name": "aerial_tramway",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a1.png?v8"
	}, {
	  "name": "afghanistan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1eb.png?v8"
	}, {
	  "name": "airplane",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2708.png?v8"
	}, {
	  "name": "aland_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1fd.png?v8"
	}, {
	  "name": "alarm_clock",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23f0.png?v8"
	}, {
	  "name": "albania",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f1.png?v8"
	}, {
	  "name": "alembic",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2697.png?v8"
	}, {
	  "name": "algeria",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e9-1f1ff.png?v8"
	}, {
	  "name": "alien",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f47d.png?v8"
	}, {
	  "name": "ambulance",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f691.png?v8"
	}, {
	  "name": "american_samoa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f8.png?v8"
	}, {
	  "name": "amphora",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3fa.png?v8"
	}, {
	  "name": "anchor",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2693.png?v8"
	}, {
	  "name": "andorra",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1e9.png?v8"
	}, {
	  "name": "angel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f47c.png?v8"
	}, {
	  "name": "anger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a2.png?v8"
	}, {
	  "name": "angola",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f4.png?v8"
	}, {
	  "name": "angry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f620.png?v8"
	}, {
	  "name": "anguilla",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1ee.png?v8"
	}, {
	  "name": "anguished",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f627.png?v8"
	}, {
	  "name": "ant",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41c.png?v8"
	}, {
	  "name": "antarctica",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f6.png?v8"
	}, {
	  "name": "antigua_barbuda",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1ec.png?v8"
	}, {
	  "name": "apple",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34e.png?v8"
	}, {
	  "name": "aquarius",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2652.png?v8"
	}, {
	  "name": "argentina",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f7.png?v8"
	}, {
	  "name": "aries",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2648.png?v8"
	}, {
	  "name": "armenia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f2.png?v8"
	}, {
	  "name": "arrow_backward",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25c0.png?v8"
	}, {
	  "name": "arrow_double_down",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23ec.png?v8"
	}, {
	  "name": "arrow_double_up",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23eb.png?v8"
	}, {
	  "name": "arrow_down",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b07.png?v8"
	}, {
	  "name": "arrow_down_small",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f53d.png?v8"
	}, {
	  "name": "arrow_forward",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25b6.png?v8"
	}, {
	  "name": "arrow_heading_down",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2935.png?v8"
	}, {
	  "name": "arrow_heading_up",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2934.png?v8"
	}, {
	  "name": "arrow_left",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b05.png?v8"
	}, {
	  "name": "arrow_lower_left",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2199.png?v8"
	}, {
	  "name": "arrow_lower_right",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2198.png?v8"
	}, {
	  "name": "arrow_right",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/27a1.png?v8"
	}, {
	  "name": "arrow_right_hook",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/21aa.png?v8"
	}, {
	  "name": "arrow_up",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b06.png?v8"
	}, {
	  "name": "arrow_up_down",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2195.png?v8"
	}, {
	  "name": "arrow_up_small",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f53c.png?v8"
	}, {
	  "name": "arrow_upper_left",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2196.png?v8"
	}, {
	  "name": "arrow_upper_right",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2197.png?v8"
	}, {
	  "name": "arrows_clockwise",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f503.png?v8"
	}, {
	  "name": "arrows_counterclockwise",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f504.png?v8"
	}, {
	  "name": "art",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a8.png?v8"
	}, {
	  "name": "articulated_lorry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f69b.png?v8"
	}, {
	  "name": "artificial_satellite",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6f0.png?v8"
	}, {
	  "name": "aruba",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1fc.png?v8"
	}, {
	  "name": "asterisk",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/002a-20e3.png?v8"
	}, {
	  "name": "astonished",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f632.png?v8"
	}, {
	  "name": "athletic_shoe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45f.png?v8"
	}, {
	  "name": "atm",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e7.png?v8"
	}, {
	  "name": "atom",
	  "image": "https://github.githubassets.com/images/icons/emoji/atom.png?v8"
	}, {
	  "name": "atom_symbol",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/269b.png?v8"
	}, {
	  "name": "australia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1fa.png?v8"
	}, {
	  "name": "austria",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1f9.png?v8"
	}, {
	  "name": "avocado",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f951.png?v8"
	}, {
	  "name": "azerbaijan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1ff.png?v8"
	}, {
	  "name": "b",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f171.png?v8"
	}, {
	  "name": "baby",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f476.png?v8"
	}, {
	  "name": "baby_bottle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f37c.png?v8"
	}, {
	  "name": "baby_chick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f424.png?v8"
	}, {
	  "name": "baby_symbol",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6bc.png?v8"
	}, {
	  "name": "back",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f519.png?v8"
	}, {
	  "name": "bacon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f953.png?v8"
	}, {
	  "name": "badminton",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f8.png?v8"
	}, {
	  "name": "baggage_claim",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6c4.png?v8"
	}, {
	  "name": "baguette_bread",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f956.png?v8"
	}, {
	  "name": "bahamas",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f8.png?v8"
	}, {
	  "name": "bahrain",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1ed.png?v8"
	}, {
	  "name": "balance_scale",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2696.png?v8"
	}, {
	  "name": "balloon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f388.png?v8"
	}, {
	  "name": "ballot_box",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5f3.png?v8"
	}, {
	  "name": "ballot_box_with_check",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2611.png?v8"
	}, {
	  "name": "bamboo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f38d.png?v8"
	}, {
	  "name": "banana",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34c.png?v8"
	}, {
	  "name": "bangbang",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/203c.png?v8"
	}, {
	  "name": "bangladesh",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1e9.png?v8"
	}, {
	  "name": "bank",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e6.png?v8"
	}, {
	  "name": "bar_chart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ca.png?v8"
	}, {
	  "name": "barbados",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1e7.png?v8"
	}, {
	  "name": "barber",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f488.png?v8"
	}, {
	  "name": "baseball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26be.png?v8"
	}, {
	  "name": "basecamp",
	  "image": "https://github.githubassets.com/images/icons/emoji/basecamp.png?v8"
	}, {
	  "name": "basecampy",
	  "image": "https://github.githubassets.com/images/icons/emoji/basecampy.png?v8"
	}, {
	  "name": "basketball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c0.png?v8"
	}, {
	  "name": "basketball_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f9.png?v8"
	}, {
	  "name": "basketball_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f9-2640.png?v8"
	}, {
	  "name": "bat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f987.png?v8"
	}, {
	  "name": "bath",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6c0.png?v8"
	}, {
	  "name": "bathtub",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6c1.png?v8"
	}, {
	  "name": "battery",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f50b.png?v8"
	}, {
	  "name": "beach_umbrella",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d6.png?v8"
	}, {
	  "name": "bear",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43b.png?v8"
	}, {
	  "name": "bed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6cf.png?v8"
	}, {
	  "name": "bee",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41d.png?v8"
	}, {
	  "name": "beer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f37a.png?v8"
	}, {
	  "name": "beers",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f37b.png?v8"
	}, {
	  "name": "beetle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41e.png?v8"
	}, {
	  "name": "beginner",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f530.png?v8"
	}, {
	  "name": "belarus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1fe.png?v8"
	}, {
	  "name": "belgium",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1ea.png?v8"
	}, {
	  "name": "belize",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1ff.png?v8"
	}, {
	  "name": "bell",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f514.png?v8"
	}, {
	  "name": "bellhop_bell",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ce.png?v8"
	}, {
	  "name": "benin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1ef.png?v8"
	}, {
	  "name": "bento",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f371.png?v8"
	}, {
	  "name": "bermuda",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f2.png?v8"
	}, {
	  "name": "bhutan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f9.png?v8"
	}, {
	  "name": "bicyclist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b4.png?v8"
	}, {
	  "name": "bike",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b2.png?v8"
	}, {
	  "name": "biking_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b4.png?v8"
	}, {
	  "name": "biking_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b4-2640.png?v8"
	}, {
	  "name": "bikini",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f459.png?v8"
	}, {
	  "name": "biohazard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2623.png?v8"
	}, {
	  "name": "bird",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f426.png?v8"
	}, {
	  "name": "birthday",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f382.png?v8"
	}, {
	  "name": "black_circle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26ab.png?v8"
	}, {
	  "name": "black_flag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f4.png?v8"
	}, {
	  "name": "black_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5a4.png?v8"
	}, {
	  "name": "black_joker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f0cf.png?v8"
	}, {
	  "name": "black_large_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b1b.png?v8"
	}, {
	  "name": "black_medium_small_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25fe.png?v8"
	}, {
	  "name": "black_medium_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25fc.png?v8"
	}, {
	  "name": "black_nib",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2712.png?v8"
	}, {
	  "name": "black_small_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25aa.png?v8"
	}, {
	  "name": "black_square_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f532.png?v8"
	}, {
	  "name": "blonde_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f471.png?v8"
	}, {
	  "name": "blonde_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f471-2640.png?v8"
	}, {
	  "name": "blossom",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f33c.png?v8"
	}, {
	  "name": "blowfish",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f421.png?v8"
	}, {
	  "name": "blue_book",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d8.png?v8"
	}, {
	  "name": "blue_car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f699.png?v8"
	}, {
	  "name": "blue_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f499.png?v8"
	}, {
	  "name": "blush",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f60a.png?v8"
	}, {
	  "name": "boar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f417.png?v8"
	}, {
	  "name": "boat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f5.png?v8"
	}, {
	  "name": "bolivia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f4.png?v8"
	}, {
	  "name": "bomb",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a3.png?v8"
	}, {
	  "name": "book",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d6.png?v8"
	}, {
	  "name": "bookmark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f516.png?v8"
	}, {
	  "name": "bookmark_tabs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d1.png?v8"
	}, {
	  "name": "books",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4da.png?v8"
	}, {
	  "name": "boom",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a5.png?v8"
	}, {
	  "name": "boot",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f462.png?v8"
	}, {
	  "name": "bosnia_herzegovina",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1e6.png?v8"
	}, {
	  "name": "botswana",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1fc.png?v8"
	}, {
	  "name": "bouquet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f490.png?v8"
	}, {
	  "name": "bow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f647.png?v8"
	}, {
	  "name": "bow_and_arrow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f9.png?v8"
	}, {
	  "name": "bowing_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f647.png?v8"
	}, {
	  "name": "bowing_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f647-2640.png?v8"
	}, {
	  "name": "bowling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b3.png?v8"
	}, {
	  "name": "bowtie",
	  "image": "https://github.githubassets.com/images/icons/emoji/bowtie.png?v8"
	}, {
	  "name": "boxing_glove",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f94a.png?v8"
	}, {
	  "name": "boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f466.png?v8"
	}, {
	  "name": "brazil",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f7.png?v8"
	}, {
	  "name": "bread",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f35e.png?v8"
	}, {
	  "name": "bride_with_veil",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f470.png?v8"
	}, {
	  "name": "bridge_at_night",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f309.png?v8"
	}, {
	  "name": "briefcase",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4bc.png?v8"
	}, {
	  "name": "british_indian_ocean_territory",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f4.png?v8"
	}, {
	  "name": "british_virgin_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1ec.png?v8"
	}, {
	  "name": "broken_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f494.png?v8"
	}, {
	  "name": "brunei",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f3.png?v8"
	}, {
	  "name": "bug",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41b.png?v8"
	}, {
	  "name": "building_construction",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d7.png?v8"
	}, {
	  "name": "bulb",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a1.png?v8"
	}, {
	  "name": "bulgaria",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1ec.png?v8"
	}, {
	  "name": "bullettrain_front",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f685.png?v8"
	}, {
	  "name": "bullettrain_side",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f684.png?v8"
	}, {
	  "name": "burkina_faso",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1eb.png?v8"
	}, {
	  "name": "burrito",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f32f.png?v8"
	}, {
	  "name": "burundi",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1ee.png?v8"
	}, {
	  "name": "bus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f68c.png?v8"
	}, {
	  "name": "business_suit_levitating",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f574.png?v8"
	}, {
	  "name": "busstop",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f68f.png?v8"
	}, {
	  "name": "bust_in_silhouette",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f464.png?v8"
	}, {
	  "name": "busts_in_silhouette",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f465.png?v8"
	}, {
	  "name": "butterfly",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f98b.png?v8"
	}, {
	  "name": "cactus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f335.png?v8"
	}, {
	  "name": "cake",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f370.png?v8"
	}, {
	  "name": "calendar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c6.png?v8"
	}, {
	  "name": "call_me_hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f919.png?v8"
	}, {
	  "name": "calling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f2.png?v8"
	}, {
	  "name": "cambodia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1ed.png?v8"
	}, {
	  "name": "camel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42b.png?v8"
	}, {
	  "name": "camera",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f7.png?v8"
	}, {
	  "name": "camera_flash",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f8.png?v8"
	}, {
	  "name": "cameroon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1f2.png?v8"
	}, {
	  "name": "camping",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d5.png?v8"
	}, {
	  "name": "canada",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1e6.png?v8"
	}, {
	  "name": "canary_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1e8.png?v8"
	}, {
	  "name": "cancer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/264b.png?v8"
	}, {
	  "name": "candle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f56f.png?v8"
	}, {
	  "name": "candy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f36c.png?v8"
	}, {
	  "name": "canoe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6f6.png?v8"
	}, {
	  "name": "cape_verde",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1fb.png?v8"
	}, {
	  "name": "capital_abcd",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f520.png?v8"
	}, {
	  "name": "capricorn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2651.png?v8"
	}, {
	  "name": "car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f697.png?v8"
	}, {
	  "name": "card_file_box",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5c3.png?v8"
	}, {
	  "name": "card_index",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c7.png?v8"
	}, {
	  "name": "card_index_dividers",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5c2.png?v8"
	}, {
	  "name": "caribbean_netherlands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f6.png?v8"
	}, {
	  "name": "carousel_horse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a0.png?v8"
	}, {
	  "name": "carrot",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f955.png?v8"
	}, {
	  "name": "cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f431.png?v8"
	}, {
	  "name": "cat2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f408.png?v8"
	}, {
	  "name": "cayman_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1fe.png?v8"
	}, {
	  "name": "cd",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4bf.png?v8"
	}, {
	  "name": "central_african_republic",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1eb.png?v8"
	}, {
	  "name": "chad",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1e9.png?v8"
	}, {
	  "name": "chains",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26d3.png?v8"
	}, {
	  "name": "champagne",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f37e.png?v8"
	}, {
	  "name": "chart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b9.png?v8"
	}, {
	  "name": "chart_with_downwards_trend",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c9.png?v8"
	}, {
	  "name": "chart_with_upwards_trend",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c8.png?v8"
	}, {
	  "name": "checkered_flag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c1.png?v8"
	}, {
	  "name": "cheese",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f9c0.png?v8"
	}, {
	  "name": "cherries",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f352.png?v8"
	}, {
	  "name": "cherry_blossom",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f338.png?v8"
	}, {
	  "name": "chestnut",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f330.png?v8"
	}, {
	  "name": "chicken",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f414.png?v8"
	}, {
	  "name": "children_crossing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b8.png?v8"
	}, {
	  "name": "chile",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1f1.png?v8"
	}, {
	  "name": "chipmunk",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43f.png?v8"
	}, {
	  "name": "chocolate_bar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f36b.png?v8"
	}, {
	  "name": "christmas_island",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1fd.png?v8"
	}, {
	  "name": "christmas_tree",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f384.png?v8"
	}, {
	  "name": "church",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26ea.png?v8"
	}, {
	  "name": "cinema",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a6.png?v8"
	}, {
	  "name": "circus_tent",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3aa.png?v8"
	}, {
	  "name": "city_sunrise",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f307.png?v8"
	}, {
	  "name": "city_sunset",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f306.png?v8"
	}, {
	  "name": "cityscape",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d9.png?v8"
	}, {
	  "name": "cl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f191.png?v8"
	}, {
	  "name": "clamp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5dc.png?v8"
	}, {
	  "name": "clap",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44f.png?v8"
	}, {
	  "name": "clapper",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ac.png?v8"
	}, {
	  "name": "classical_building",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3db.png?v8"
	}, {
	  "name": "clinking_glasses",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f942.png?v8"
	}, {
	  "name": "clipboard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4cb.png?v8"
	}, {
	  "name": "clock1",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f550.png?v8"
	}, {
	  "name": "clock10",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f559.png?v8"
	}, {
	  "name": "clock1030",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f565.png?v8"
	}, {
	  "name": "clock11",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f55a.png?v8"
	}, {
	  "name": "clock1130",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f566.png?v8"
	}, {
	  "name": "clock12",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f55b.png?v8"
	}, {
	  "name": "clock1230",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f567.png?v8"
	}, {
	  "name": "clock130",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f55c.png?v8"
	}, {
	  "name": "clock2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f551.png?v8"
	}, {
	  "name": "clock230",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f55d.png?v8"
	}, {
	  "name": "clock3",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f552.png?v8"
	}, {
	  "name": "clock330",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f55e.png?v8"
	}, {
	  "name": "clock4",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f553.png?v8"
	}, {
	  "name": "clock430",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f55f.png?v8"
	}, {
	  "name": "clock5",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f554.png?v8"
	}, {
	  "name": "clock530",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f560.png?v8"
	}, {
	  "name": "clock6",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f555.png?v8"
	}, {
	  "name": "clock630",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f561.png?v8"
	}, {
	  "name": "clock7",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f556.png?v8"
	}, {
	  "name": "clock730",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f562.png?v8"
	}, {
	  "name": "clock8",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f557.png?v8"
	}, {
	  "name": "clock830",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f563.png?v8"
	}, {
	  "name": "clock9",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f558.png?v8"
	}, {
	  "name": "clock930",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f564.png?v8"
	}, {
	  "name": "closed_book",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d5.png?v8"
	}, {
	  "name": "closed_lock_with_key",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f510.png?v8"
	}, {
	  "name": "closed_umbrella",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f302.png?v8"
	}, {
	  "name": "cloud",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2601.png?v8"
	}, {
	  "name": "cloud_with_lightning",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f329.png?v8"
	}, {
	  "name": "cloud_with_lightning_and_rain",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26c8.png?v8"
	}, {
	  "name": "cloud_with_rain",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f327.png?v8"
	}, {
	  "name": "cloud_with_snow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f328.png?v8"
	}, {
	  "name": "clown_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f921.png?v8"
	}, {
	  "name": "clubs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2663.png?v8"
	}, {
	  "name": "cn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1f3.png?v8"
	}, {
	  "name": "cocktail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f378.png?v8"
	}, {
	  "name": "cocos_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1e8.png?v8"
	}, {
	  "name": "coffee",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2615.png?v8"
	}, {
	  "name": "coffin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26b0.png?v8"
	}, {
	  "name": "cold_sweat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f630.png?v8"
	}, {
	  "name": "collision",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a5.png?v8"
	}, {
	  "name": "colombia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1f4.png?v8"
	}, {
	  "name": "comet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2604.png?v8"
	}, {
	  "name": "comoros",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1f2.png?v8"
	}, {
	  "name": "computer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4bb.png?v8"
	}, {
	  "name": "computer_mouse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5b1.png?v8"
	}, {
	  "name": "confetti_ball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f38a.png?v8"
	}, {
	  "name": "confounded",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f616.png?v8"
	}, {
	  "name": "confused",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f615.png?v8"
	}, {
	  "name": "congo_brazzaville",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1ec.png?v8"
	}, {
	  "name": "congo_kinshasa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1e9.png?v8"
	}, {
	  "name": "congratulations",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/3297.png?v8"
	}, {
	  "name": "construction",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a7.png?v8"
	}, {
	  "name": "construction_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f477.png?v8"
	}, {
	  "name": "construction_worker_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f477.png?v8"
	}, {
	  "name": "construction_worker_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f477-2640.png?v8"
	}, {
	  "name": "control_knobs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f39b.png?v8"
	}, {
	  "name": "convenience_store",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ea.png?v8"
	}, {
	  "name": "cook_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1f0.png?v8"
	}, {
	  "name": "cookie",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f36a.png?v8"
	}, {
	  "name": "cool",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f192.png?v8"
	}, {
	  "name": "cop",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46e.png?v8"
	}, {
	  "name": "copyright",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/00a9.png?v8"
	}, {
	  "name": "corn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f33d.png?v8"
	}, {
	  "name": "costa_rica",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1f7.png?v8"
	}, {
	  "name": "cote_divoire",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1ee.png?v8"
	}, {
	  "name": "couch_and_lamp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6cb.png?v8"
	}, {
	  "name": "couple",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46b.png?v8"
	}, {
	  "name": "couple_with_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f491.png?v8"
	}, {
	  "name": "couple_with_heart_man_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-2764-1f468.png?v8"
	}, {
	  "name": "couple_with_heart_woman_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f491.png?v8"
	}, {
	  "name": "couple_with_heart_woman_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-2764-1f469.png?v8"
	}, {
	  "name": "couplekiss_man_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-2764-1f48b-1f468.png?v8"
	}, {
	  "name": "couplekiss_man_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f48f.png?v8"
	}, {
	  "name": "couplekiss_woman_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-2764-1f48b-1f469.png?v8"
	}, {
	  "name": "cow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42e.png?v8"
	}, {
	  "name": "cow2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f404.png?v8"
	}, {
	  "name": "cowboy_hat_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f920.png?v8"
	}, {
	  "name": "crab",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f980.png?v8"
	}, {
	  "name": "crayon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f58d.png?v8"
	}, {
	  "name": "credit_card",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b3.png?v8"
	}, {
	  "name": "crescent_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f319.png?v8"
	}, {
	  "name": "cricket",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3cf.png?v8"
	}, {
	  "name": "croatia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ed-1f1f7.png?v8"
	}, {
	  "name": "crocodile",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f40a.png?v8"
	}, {
	  "name": "croissant",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f950.png?v8"
	}, {
	  "name": "crossed_fingers",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f91e.png?v8"
	}, {
	  "name": "crossed_flags",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f38c.png?v8"
	}, {
	  "name": "crossed_swords",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2694.png?v8"
	}, {
	  "name": "crown",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f451.png?v8"
	}, {
	  "name": "cry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f622.png?v8"
	}, {
	  "name": "crying_cat_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f63f.png?v8"
	}, {
	  "name": "crystal_ball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52e.png?v8"
	}, {
	  "name": "cuba",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1fa.png?v8"
	}, {
	  "name": "cucumber",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f952.png?v8"
	}, {
	  "name": "cupid",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f498.png?v8"
	}, {
	  "name": "curacao",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1fc.png?v8"
	}, {
	  "name": "curly_loop",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/27b0.png?v8"
	}, {
	  "name": "currency_exchange",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b1.png?v8"
	}, {
	  "name": "curry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f35b.png?v8"
	}, {
	  "name": "custard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f36e.png?v8"
	}, {
	  "name": "customs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6c3.png?v8"
	}, {
	  "name": "cyclone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f300.png?v8"
	}, {
	  "name": "cyprus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1fe.png?v8"
	}, {
	  "name": "czech_republic",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1ff.png?v8"
	}, {
	  "name": "dagger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5e1.png?v8"
	}, {
	  "name": "dancer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f483.png?v8"
	}, {
	  "name": "dancers",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46f.png?v8"
	}, {
	  "name": "dancing_men",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46f-2642.png?v8"
	}, {
	  "name": "dancing_women",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46f.png?v8"
	}, {
	  "name": "dango",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f361.png?v8"
	}, {
	  "name": "dark_sunglasses",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f576.png?v8"
	}, {
	  "name": "dart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3af.png?v8"
	}, {
	  "name": "dash",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a8.png?v8"
	}, {
	  "name": "date",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c5.png?v8"
	}, {
	  "name": "de",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e9-1f1ea.png?v8"
	}, {
	  "name": "deciduous_tree",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f333.png?v8"
	}, {
	  "name": "deer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f98c.png?v8"
	}, {
	  "name": "denmark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e9-1f1f0.png?v8"
	}, {
	  "name": "department_store",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ec.png?v8"
	}, {
	  "name": "derelict_house",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3da.png?v8"
	}, {
	  "name": "desert",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3dc.png?v8"
	}, {
	  "name": "desert_island",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3dd.png?v8"
	}, {
	  "name": "desktop_computer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5a5.png?v8"
	}, {
	  "name": "detective",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f575.png?v8"
	}, {
	  "name": "diamond_shape_with_a_dot_inside",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a0.png?v8"
	}, {
	  "name": "diamonds",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2666.png?v8"
	}, {
	  "name": "disappointed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f61e.png?v8"
	}, {
	  "name": "disappointed_relieved",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f625.png?v8"
	}, {
	  "name": "dizzy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ab.png?v8"
	}, {
	  "name": "dizzy_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f635.png?v8"
	}, {
	  "name": "djibouti",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e9-1f1ef.png?v8"
	}, {
	  "name": "do_not_litter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6af.png?v8"
	}, {
	  "name": "dog",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f436.png?v8"
	}, {
	  "name": "dog2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f415.png?v8"
	}, {
	  "name": "dollar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b5.png?v8"
	}, {
	  "name": "dolls",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f38e.png?v8"
	}, {
	  "name": "dolphin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42c.png?v8"
	}, {
	  "name": "dominica",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e9-1f1f2.png?v8"
	}, {
	  "name": "dominican_republic",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e9-1f1f4.png?v8"
	}, {
	  "name": "door",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6aa.png?v8"
	}, {
	  "name": "doughnut",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f369.png?v8"
	}, {
	  "name": "dove",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f54a.png?v8"
	}, {
	  "name": "dragon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f409.png?v8"
	}, {
	  "name": "dragon_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f432.png?v8"
	}, {
	  "name": "dress",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f457.png?v8"
	}, {
	  "name": "dromedary_camel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42a.png?v8"
	}, {
	  "name": "drooling_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f924.png?v8"
	}, {
	  "name": "droplet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a7.png?v8"
	}, {
	  "name": "drum",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f941.png?v8"
	}, {
	  "name": "duck",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f986.png?v8"
	}, {
	  "name": "dvd",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c0.png?v8"
	}, {
	  "name": "e-mail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e7.png?v8"
	}, {
	  "name": "eagle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f985.png?v8"
	}, {
	  "name": "ear",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f442.png?v8"
	}, {
	  "name": "ear_of_rice",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f33e.png?v8"
	}, {
	  "name": "earth_africa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f30d.png?v8"
	}, {
	  "name": "earth_americas",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f30e.png?v8"
	}, {
	  "name": "earth_asia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f30f.png?v8"
	}, {
	  "name": "ecuador",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1e8.png?v8"
	}, {
	  "name": "egg",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f95a.png?v8"
	}, {
	  "name": "eggplant",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f346.png?v8"
	}, {
	  "name": "egypt",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1ec.png?v8"
	}, {
	  "name": "eight",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0038-20e3.png?v8"
	}, {
	  "name": "eight_pointed_black_star",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2734.png?v8"
	}, {
	  "name": "eight_spoked_asterisk",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2733.png?v8"
	}, {
	  "name": "el_salvador",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1fb.png?v8"
	}, {
	  "name": "electric_plug",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f50c.png?v8"
	}, {
	  "name": "electron",
	  "image": "https://github.githubassets.com/images/icons/emoji/electron.png?v8"
	}, {
	  "name": "elephant",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f418.png?v8"
	}, {
	  "name": "email",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2709.png?v8"
	}, {
	  "name": "end",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f51a.png?v8"
	}, {
	  "name": "envelope",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2709.png?v8"
	}, {
	  "name": "envelope_with_arrow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e9.png?v8"
	}, {
	  "name": "equatorial_guinea",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f6.png?v8"
	}, {
	  "name": "eritrea",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1f7.png?v8"
	}, {
	  "name": "es",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1f8.png?v8"
	}, {
	  "name": "estonia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1ea.png?v8"
	}, {
	  "name": "ethiopia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1f9.png?v8"
	}, {
	  "name": "eu",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1fa.png?v8"
	}, {
	  "name": "euro",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b6.png?v8"
	}, {
	  "name": "european_castle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f0.png?v8"
	}, {
	  "name": "european_post_office",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e4.png?v8"
	}, {
	  "name": "european_union",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1fa.png?v8"
	}, {
	  "name": "evergreen_tree",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f332.png?v8"
	}, {
	  "name": "exclamation",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2757.png?v8"
	}, {
	  "name": "expressionless",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f611.png?v8"
	}, {
	  "name": "eye",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f441.png?v8"
	}, {
	  "name": "eye_speech_bubble",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f441-1f5e8.png?v8"
	}, {
	  "name": "eyeglasses",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f453.png?v8"
	}, {
	  "name": "eyes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f440.png?v8"
	}, {
	  "name": "face_with_head_bandage",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f915.png?v8"
	}, {
	  "name": "face_with_thermometer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f912.png?v8"
	}, {
	  "name": "facepunch",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44a.png?v8"
	}, {
	  "name": "factory",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ed.png?v8"
	}, {
	  "name": "falkland_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1eb-1f1f0.png?v8"
	}, {
	  "name": "fallen_leaf",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f342.png?v8"
	}, {
	  "name": "family",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46a.png?v8"
	}, {
	  "name": "family_man_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f466.png?v8"
	}, {
	  "name": "family_man_boy_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f466-1f466.png?v8"
	}, {
	  "name": "family_man_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f467.png?v8"
	}, {
	  "name": "family_man_girl_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f467-1f466.png?v8"
	}, {
	  "name": "family_man_girl_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f467-1f467.png?v8"
	}, {
	  "name": "family_man_man_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f468-1f466.png?v8"
	}, {
	  "name": "family_man_man_boy_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f468-1f466-1f466.png?v8"
	}, {
	  "name": "family_man_man_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f468-1f467.png?v8"
	}, {
	  "name": "family_man_man_girl_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f468-1f467-1f466.png?v8"
	}, {
	  "name": "family_man_man_girl_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f468-1f467-1f467.png?v8"
	}, {
	  "name": "family_man_woman_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46a.png?v8"
	}, {
	  "name": "family_man_woman_boy_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f469-1f466-1f466.png?v8"
	}, {
	  "name": "family_man_woman_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f469-1f467.png?v8"
	}, {
	  "name": "family_man_woman_girl_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f469-1f467-1f466.png?v8"
	}, {
	  "name": "family_man_woman_girl_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f469-1f467-1f467.png?v8"
	}, {
	  "name": "family_woman_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f466.png?v8"
	}, {
	  "name": "family_woman_boy_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f466-1f466.png?v8"
	}, {
	  "name": "family_woman_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f467.png?v8"
	}, {
	  "name": "family_woman_girl_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f467-1f466.png?v8"
	}, {
	  "name": "family_woman_girl_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f467-1f467.png?v8"
	}, {
	  "name": "family_woman_woman_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f469-1f466.png?v8"
	}, {
	  "name": "family_woman_woman_boy_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f469-1f466-1f466.png?v8"
	}, {
	  "name": "family_woman_woman_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f469-1f467.png?v8"
	}, {
	  "name": "family_woman_woman_girl_boy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f469-1f467-1f466.png?v8"
	}, {
	  "name": "family_woman_woman_girl_girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f469-1f467-1f467.png?v8"
	}, {
	  "name": "faroe_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1eb-1f1f4.png?v8"
	}, {
	  "name": "fast_forward",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23e9.png?v8"
	}, {
	  "name": "fax",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e0.png?v8"
	}, {
	  "name": "fearful",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f628.png?v8"
	}, {
	  "name": "feelsgood",
	  "image": "https://github.githubassets.com/images/icons/emoji/feelsgood.png?v8"
	}, {
	  "name": "feet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43e.png?v8"
	}, {
	  "name": "female_detective",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f575-2640.png?v8"
	}, {
	  "name": "ferris_wheel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a1.png?v8"
	}, {
	  "name": "ferry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f4.png?v8"
	}, {
	  "name": "field_hockey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d1.png?v8"
	}, {
	  "name": "fiji",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1eb-1f1ef.png?v8"
	}, {
	  "name": "file_cabinet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5c4.png?v8"
	}, {
	  "name": "file_folder",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c1.png?v8"
	}, {
	  "name": "film_projector",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4fd.png?v8"
	}, {
	  "name": "film_strip",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f39e.png?v8"
	}, {
	  "name": "finland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1eb-1f1ee.png?v8"
	}, {
	  "name": "finnadie",
	  "image": "https://github.githubassets.com/images/icons/emoji/finnadie.png?v8"
	}, {
	  "name": "fire",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f525.png?v8"
	}, {
	  "name": "fire_engine",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f692.png?v8"
	}, {
	  "name": "fireworks",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f386.png?v8"
	}, {
	  "name": "first_quarter_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f313.png?v8"
	}, {
	  "name": "first_quarter_moon_with_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f31b.png?v8"
	}, {
	  "name": "fish",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41f.png?v8"
	}, {
	  "name": "fish_cake",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f365.png?v8"
	}, {
	  "name": "fishing_pole_and_fish",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a3.png?v8"
	}, {
	  "name": "fist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270a.png?v8"
	}, {
	  "name": "fist_left",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f91b.png?v8"
	}, {
	  "name": "fist_oncoming",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44a.png?v8"
	}, {
	  "name": "fist_raised",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270a.png?v8"
	}, {
	  "name": "fist_right",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f91c.png?v8"
	}, {
	  "name": "five",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0035-20e3.png?v8"
	}, {
	  "name": "flags",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f38f.png?v8"
	}, {
	  "name": "flashlight",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f526.png?v8"
	}, {
	  "name": "fleur_de_lis",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/269c.png?v8"
	}, {
	  "name": "flight_arrival",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ec.png?v8"
	}, {
	  "name": "flight_departure",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6eb.png?v8"
	}, {
	  "name": "flipper",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42c.png?v8"
	}, {
	  "name": "floppy_disk",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4be.png?v8"
	}, {
	  "name": "flower_playing_cards",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b4.png?v8"
	}, {
	  "name": "flushed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f633.png?v8"
	}, {
	  "name": "fog",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f32b.png?v8"
	}, {
	  "name": "foggy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f301.png?v8"
	}, {
	  "name": "football",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c8.png?v8"
	}, {
	  "name": "footprints",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f463.png?v8"
	}, {
	  "name": "fork_and_knife",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f374.png?v8"
	}, {
	  "name": "fountain",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f2.png?v8"
	}, {
	  "name": "fountain_pen",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f58b.png?v8"
	}, {
	  "name": "four",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0034-20e3.png?v8"
	}, {
	  "name": "four_leaf_clover",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f340.png?v8"
	}, {
	  "name": "fox_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f98a.png?v8"
	}, {
	  "name": "fr",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1eb-1f1f7.png?v8"
	}, {
	  "name": "framed_picture",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5bc.png?v8"
	}, {
	  "name": "free",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f193.png?v8"
	}, {
	  "name": "french_guiana",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1eb.png?v8"
	}, {
	  "name": "french_polynesia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1eb.png?v8"
	}, {
	  "name": "french_southern_territories",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1eb.png?v8"
	}, {
	  "name": "fried_egg",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f373.png?v8"
	}, {
	  "name": "fried_shrimp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f364.png?v8"
	}, {
	  "name": "fries",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f35f.png?v8"
	}, {
	  "name": "frog",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f438.png?v8"
	}, {
	  "name": "frowning",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f626.png?v8"
	}, {
	  "name": "frowning_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2639.png?v8"
	}, {
	  "name": "frowning_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64d-2642.png?v8"
	}, {
	  "name": "frowning_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64d.png?v8"
	}, {
	  "name": "fu",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f595.png?v8"
	}, {
	  "name": "fuelpump",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26fd.png?v8"
	}, {
	  "name": "full_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f315.png?v8"
	}, {
	  "name": "full_moon_with_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f31d.png?v8"
	}, {
	  "name": "funeral_urn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26b1.png?v8"
	}, {
	  "name": "gabon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1e6.png?v8"
	}, {
	  "name": "gambia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f2.png?v8"
	}, {
	  "name": "game_die",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b2.png?v8"
	}, {
	  "name": "gb",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1e7.png?v8"
	}, {
	  "name": "gear",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2699.png?v8"
	}, {
	  "name": "gem",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f48e.png?v8"
	}, {
	  "name": "gemini",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/264a.png?v8"
	}, {
	  "name": "georgia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1ea.png?v8"
	}, {
	  "name": "ghana",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1ed.png?v8"
	}, {
	  "name": "ghost",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f47b.png?v8"
	}, {
	  "name": "gibraltar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1ee.png?v8"
	}, {
	  "name": "gift",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f381.png?v8"
	}, {
	  "name": "gift_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f49d.png?v8"
	}, {
	  "name": "girl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f467.png?v8"
	}, {
	  "name": "globe_with_meridians",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f310.png?v8"
	}, {
	  "name": "goal_net",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f945.png?v8"
	}, {
	  "name": "goat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f410.png?v8"
	}, {
	  "name": "goberserk",
	  "image": "https://github.githubassets.com/images/icons/emoji/goberserk.png?v8"
	}, {
	  "name": "godmode",
	  "image": "https://github.githubassets.com/images/icons/emoji/godmode.png?v8"
	}, {
	  "name": "golf",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f3.png?v8"
	}, {
	  "name": "golfing_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3cc.png?v8"
	}, {
	  "name": "golfing_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3cc-2640.png?v8"
	}, {
	  "name": "gorilla",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f98d.png?v8"
	}, {
	  "name": "grapes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f347.png?v8"
	}, {
	  "name": "greece",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f7.png?v8"
	}, {
	  "name": "green_apple",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34f.png?v8"
	}, {
	  "name": "green_book",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d7.png?v8"
	}, {
	  "name": "green_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f49a.png?v8"
	}, {
	  "name": "green_salad",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f957.png?v8"
	}, {
	  "name": "greenland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f1.png?v8"
	}, {
	  "name": "grenada",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1e9.png?v8"
	}, {
	  "name": "grey_exclamation",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2755.png?v8"
	}, {
	  "name": "grey_question",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2754.png?v8"
	}, {
	  "name": "grimacing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f62c.png?v8"
	}, {
	  "name": "grin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f601.png?v8"
	}, {
	  "name": "grinning",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f600.png?v8"
	}, {
	  "name": "guadeloupe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f5.png?v8"
	}, {
	  "name": "guam",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1fa.png?v8"
	}, {
	  "name": "guardsman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f482.png?v8"
	}, {
	  "name": "guardswoman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f482-2640.png?v8"
	}, {
	  "name": "guatemala",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f9.png?v8"
	}, {
	  "name": "guernsey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1ec.png?v8"
	}, {
	  "name": "guinea",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f3.png?v8"
	}, {
	  "name": "guinea_bissau",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1fc.png?v8"
	}, {
	  "name": "guitar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b8.png?v8"
	}, {
	  "name": "gun",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52b.png?v8"
	}, {
	  "name": "guyana",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1fe.png?v8"
	}, {
	  "name": "haircut",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f487.png?v8"
	}, {
	  "name": "haircut_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f487-2642.png?v8"
	}, {
	  "name": "haircut_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f487.png?v8"
	}, {
	  "name": "haiti",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ed-1f1f9.png?v8"
	}, {
	  "name": "hamburger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f354.png?v8"
	}, {
	  "name": "hammer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f528.png?v8"
	}, {
	  "name": "hammer_and_pick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2692.png?v8"
	}, {
	  "name": "hammer_and_wrench",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e0.png?v8"
	}, {
	  "name": "hamster",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f439.png?v8"
	}, {
	  "name": "hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270b.png?v8"
	}, {
	  "name": "handbag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45c.png?v8"
	}, {
	  "name": "handshake",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f91d.png?v8"
	}, {
	  "name": "hankey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a9.png?v8"
	}, {
	  "name": "hash",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0023-20e3.png?v8"
	}, {
	  "name": "hatched_chick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f425.png?v8"
	}, {
	  "name": "hatching_chick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f423.png?v8"
	}, {
	  "name": "headphones",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a7.png?v8"
	}, {
	  "name": "hear_no_evil",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f649.png?v8"
	}, {
	  "name": "heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2764.png?v8"
	}, {
	  "name": "heart_decoration",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f49f.png?v8"
	}, {
	  "name": "heart_eyes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f60d.png?v8"
	}, {
	  "name": "heart_eyes_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f63b.png?v8"
	}, {
	  "name": "heartbeat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f493.png?v8"
	}, {
	  "name": "heartpulse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f497.png?v8"
	}, {
	  "name": "hearts",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2665.png?v8"
	}, {
	  "name": "heavy_check_mark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2714.png?v8"
	}, {
	  "name": "heavy_division_sign",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2797.png?v8"
	}, {
	  "name": "heavy_dollar_sign",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b2.png?v8"
	}, {
	  "name": "heavy_exclamation_mark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2757.png?v8"
	}, {
	  "name": "heavy_heart_exclamation",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2763.png?v8"
	}, {
	  "name": "heavy_minus_sign",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2796.png?v8"
	}, {
	  "name": "heavy_multiplication_x",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2716.png?v8"
	}, {
	  "name": "heavy_plus_sign",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2795.png?v8"
	}, {
	  "name": "helicopter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f681.png?v8"
	}, {
	  "name": "herb",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f33f.png?v8"
	}, {
	  "name": "hibiscus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f33a.png?v8"
	}, {
	  "name": "high_brightness",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f506.png?v8"
	}, {
	  "name": "high_heel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f460.png?v8"
	}, {
	  "name": "hocho",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52a.png?v8"
	}, {
	  "name": "hole",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f573.png?v8"
	}, {
	  "name": "honduras",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ed-1f1f3.png?v8"
	}, {
	  "name": "honey_pot",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f36f.png?v8"
	}, {
	  "name": "honeybee",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41d.png?v8"
	}, {
	  "name": "hong_kong",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ed-1f1f0.png?v8"
	}, {
	  "name": "horse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f434.png?v8"
	}, {
	  "name": "horse_racing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c7.png?v8"
	}, {
	  "name": "hospital",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e5.png?v8"
	}, {
	  "name": "hot_pepper",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f336.png?v8"
	}, {
	  "name": "hotdog",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f32d.png?v8"
	}, {
	  "name": "hotel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e8.png?v8"
	}, {
	  "name": "hotsprings",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2668.png?v8"
	}, {
	  "name": "hourglass",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/231b.png?v8"
	}, {
	  "name": "hourglass_flowing_sand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23f3.png?v8"
	}, {
	  "name": "house",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e0.png?v8"
	}, {
	  "name": "house_with_garden",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e1.png?v8"
	}, {
	  "name": "houses",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d8.png?v8"
	}, {
	  "name": "hugs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f917.png?v8"
	}, {
	  "name": "hungary",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ed-1f1fa.png?v8"
	}, {
	  "name": "hurtrealbad",
	  "image": "https://github.githubassets.com/images/icons/emoji/hurtrealbad.png?v8"
	}, {
	  "name": "hushed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f62f.png?v8"
	}, {
	  "name": "ice_cream",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f368.png?v8"
	}, {
	  "name": "ice_hockey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d2.png?v8"
	}, {
	  "name": "ice_skate",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f8.png?v8"
	}, {
	  "name": "icecream",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f366.png?v8"
	}, {
	  "name": "iceland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f8.png?v8"
	}, {
	  "name": "id",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f194.png?v8"
	}, {
	  "name": "ideograph_advantage",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f250.png?v8"
	}, {
	  "name": "imp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f47f.png?v8"
	}, {
	  "name": "inbox_tray",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e5.png?v8"
	}, {
	  "name": "incoming_envelope",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e8.png?v8"
	}, {
	  "name": "india",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f3.png?v8"
	}, {
	  "name": "indonesia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1e9.png?v8"
	}, {
	  "name": "information_desk_person",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f481.png?v8"
	}, {
	  "name": "information_source",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2139.png?v8"
	}, {
	  "name": "innocent",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f607.png?v8"
	}, {
	  "name": "interrobang",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2049.png?v8"
	}, {
	  "name": "iphone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f1.png?v8"
	}, {
	  "name": "iran",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f7.png?v8"
	}, {
	  "name": "iraq",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f6.png?v8"
	}, {
	  "name": "ireland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1ea.png?v8"
	}, {
	  "name": "isle_of_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f2.png?v8"
	}, {
	  "name": "israel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f1.png?v8"
	}, {
	  "name": "it",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ee-1f1f9.png?v8"
	}, {
	  "name": "izakaya_lantern",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ee.png?v8"
	}, {
	  "name": "jack_o_lantern",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f383.png?v8"
	}, {
	  "name": "jamaica",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ef-1f1f2.png?v8"
	}, {
	  "name": "japan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5fe.png?v8"
	}, {
	  "name": "japanese_castle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ef.png?v8"
	}, {
	  "name": "japanese_goblin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f47a.png?v8"
	}, {
	  "name": "japanese_ogre",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f479.png?v8"
	}, {
	  "name": "jeans",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f456.png?v8"
	}, {
	  "name": "jersey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ef-1f1ea.png?v8"
	}, {
	  "name": "jordan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ef-1f1f4.png?v8"
	}, {
	  "name": "joy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f602.png?v8"
	}, {
	  "name": "joy_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f639.png?v8"
	}, {
	  "name": "joystick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f579.png?v8"
	}, {
	  "name": "jp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ef-1f1f5.png?v8"
	}, {
	  "name": "kaaba",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f54b.png?v8"
	}, {
	  "name": "kazakhstan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1ff.png?v8"
	}, {
	  "name": "kenya",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1ea.png?v8"
	}, {
	  "name": "key",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f511.png?v8"
	}, {
	  "name": "keyboard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2328.png?v8"
	}, {
	  "name": "keycap_ten",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f51f.png?v8"
	}, {
	  "name": "kick_scooter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6f4.png?v8"
	}, {
	  "name": "kimono",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f458.png?v8"
	}, {
	  "name": "kiribati",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1ee.png?v8"
	}, {
	  "name": "kiss",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f48b.png?v8"
	}, {
	  "name": "kissing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f617.png?v8"
	}, {
	  "name": "kissing_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f63d.png?v8"
	}, {
	  "name": "kissing_closed_eyes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f61a.png?v8"
	}, {
	  "name": "kissing_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f618.png?v8"
	}, {
	  "name": "kissing_smiling_eyes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f619.png?v8"
	}, {
	  "name": "kiwi_fruit",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f95d.png?v8"
	}, {
	  "name": "knife",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52a.png?v8"
	}, {
	  "name": "koala",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f428.png?v8"
	}, {
	  "name": "koko",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f201.png?v8"
	}, {
	  "name": "kosovo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fd-1f1f0.png?v8"
	}, {
	  "name": "kr",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1f7.png?v8"
	}, {
	  "name": "kuwait",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1fc.png?v8"
	}, {
	  "name": "kyrgyzstan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1ec.png?v8"
	}, {
	  "name": "label",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f7.png?v8"
	}, {
	  "name": "lantern",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ee.png?v8"
	}, {
	  "name": "laos",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1e6.png?v8"
	}, {
	  "name": "large_blue_circle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f535.png?v8"
	}, {
	  "name": "large_blue_diamond",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f537.png?v8"
	}, {
	  "name": "large_orange_diamond",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f536.png?v8"
	}, {
	  "name": "last_quarter_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f317.png?v8"
	}, {
	  "name": "last_quarter_moon_with_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f31c.png?v8"
	}, {
	  "name": "latin_cross",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/271d.png?v8"
	}, {
	  "name": "latvia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1fb.png?v8"
	}, {
	  "name": "laughing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f606.png?v8"
	}, {
	  "name": "leaves",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f343.png?v8"
	}, {
	  "name": "lebanon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1e7.png?v8"
	}, {
	  "name": "ledger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d2.png?v8"
	}, {
	  "name": "left_luggage",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6c5.png?v8"
	}, {
	  "name": "left_right_arrow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2194.png?v8"
	}, {
	  "name": "leftwards_arrow_with_hook",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/21a9.png?v8"
	}, {
	  "name": "lemon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34b.png?v8"
	}, {
	  "name": "leo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/264c.png?v8"
	}, {
	  "name": "leopard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f406.png?v8"
	}, {
	  "name": "lesotho",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1f8.png?v8"
	}, {
	  "name": "level_slider",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f39a.png?v8"
	}, {
	  "name": "liberia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1f7.png?v8"
	}, {
	  "name": "libra",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/264e.png?v8"
	}, {
	  "name": "libya",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1fe.png?v8"
	}, {
	  "name": "liechtenstein",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1ee.png?v8"
	}, {
	  "name": "light_rail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f688.png?v8"
	}, {
	  "name": "link",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f517.png?v8"
	}, {
	  "name": "lion",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f981.png?v8"
	}, {
	  "name": "lips",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f444.png?v8"
	}, {
	  "name": "lipstick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f484.png?v8"
	}, {
	  "name": "lithuania",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1f9.png?v8"
	}, {
	  "name": "lizard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f98e.png?v8"
	}, {
	  "name": "lock",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f512.png?v8"
	}, {
	  "name": "lock_with_ink_pen",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f50f.png?v8"
	}, {
	  "name": "lollipop",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f36d.png?v8"
	}, {
	  "name": "loop",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/27bf.png?v8"
	}, {
	  "name": "loud_sound",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f50a.png?v8"
	}, {
	  "name": "loudspeaker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e2.png?v8"
	}, {
	  "name": "love_hotel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e9.png?v8"
	}, {
	  "name": "love_letter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f48c.png?v8"
	}, {
	  "name": "low_brightness",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f505.png?v8"
	}, {
	  "name": "luxembourg",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1fa.png?v8"
	}, {
	  "name": "lying_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f925.png?v8"
	}, {
	  "name": "m",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/24c2.png?v8"
	}, {
	  "name": "macau",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f4.png?v8"
	}, {
	  "name": "macedonia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f0.png?v8"
	}, {
	  "name": "madagascar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1ec.png?v8"
	}, {
	  "name": "mag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f50d.png?v8"
	}, {
	  "name": "mag_right",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f50e.png?v8"
	}, {
	  "name": "mahjong",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f004.png?v8"
	}, {
	  "name": "mailbox",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4eb.png?v8"
	}, {
	  "name": "mailbox_closed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ea.png?v8"
	}, {
	  "name": "mailbox_with_mail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ec.png?v8"
	}, {
	  "name": "mailbox_with_no_mail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ed.png?v8"
	}, {
	  "name": "malawi",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1fc.png?v8"
	}, {
	  "name": "malaysia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1fe.png?v8"
	}, {
	  "name": "maldives",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1fb.png?v8"
	}, {
	  "name": "male_detective",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f575.png?v8"
	}, {
	  "name": "mali",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f1.png?v8"
	}, {
	  "name": "malta",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f9.png?v8"
	}, {
	  "name": "man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468.png?v8"
	}, {
	  "name": "man_artist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f3a8.png?v8"
	}, {
	  "name": "man_astronaut",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f680.png?v8"
	}, {
	  "name": "man_cartwheeling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f938-2642.png?v8"
	}, {
	  "name": "man_cook",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f373.png?v8"
	}, {
	  "name": "man_dancing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f57a.png?v8"
	}, {
	  "name": "man_facepalming",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f926-2642.png?v8"
	}, {
	  "name": "man_factory_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f3ed.png?v8"
	}, {
	  "name": "man_farmer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f33e.png?v8"
	}, {
	  "name": "man_firefighter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f692.png?v8"
	}, {
	  "name": "man_health_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-2695.png?v8"
	}, {
	  "name": "man_in_tuxedo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f935.png?v8"
	}, {
	  "name": "man_judge",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-2696.png?v8"
	}, {
	  "name": "man_juggling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f939-2642.png?v8"
	}, {
	  "name": "man_mechanic",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f527.png?v8"
	}, {
	  "name": "man_office_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f4bc.png?v8"
	}, {
	  "name": "man_pilot",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-2708.png?v8"
	}, {
	  "name": "man_playing_handball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93e-2642.png?v8"
	}, {
	  "name": "man_playing_water_polo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93d-2642.png?v8"
	}, {
	  "name": "man_scientist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f52c.png?v8"
	}, {
	  "name": "man_shrugging",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f937-2642.png?v8"
	}, {
	  "name": "man_singer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f3a4.png?v8"
	}, {
	  "name": "man_student",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f393.png?v8"
	}, {
	  "name": "man_teacher",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f3eb.png?v8"
	}, {
	  "name": "man_technologist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f468-1f4bb.png?v8"
	}, {
	  "name": "man_with_gua_pi_mao",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f472.png?v8"
	}, {
	  "name": "man_with_turban",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f473.png?v8"
	}, {
	  "name": "mandarin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34a.png?v8"
	}, {
	  "name": "mans_shoe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45e.png?v8"
	}, {
	  "name": "mantelpiece_clock",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f570.png?v8"
	}, {
	  "name": "maple_leaf",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f341.png?v8"
	}, {
	  "name": "marshall_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1ed.png?v8"
	}, {
	  "name": "martial_arts_uniform",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f94b.png?v8"
	}, {
	  "name": "martinique",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f6.png?v8"
	}, {
	  "name": "mask",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f637.png?v8"
	}, {
	  "name": "massage",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f486.png?v8"
	}, {
	  "name": "massage_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f486-2642.png?v8"
	}, {
	  "name": "massage_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f486.png?v8"
	}, {
	  "name": "mauritania",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f7.png?v8"
	}, {
	  "name": "mauritius",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1fa.png?v8"
	}, {
	  "name": "mayotte",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fe-1f1f9.png?v8"
	}, {
	  "name": "meat_on_bone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f356.png?v8"
	}, {
	  "name": "medal_military",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f396.png?v8"
	}, {
	  "name": "medal_sports",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c5.png?v8"
	}, {
	  "name": "mega",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e3.png?v8"
	}, {
	  "name": "melon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f348.png?v8"
	}, {
	  "name": "memo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4dd.png?v8"
	}, {
	  "name": "men_wrestling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93c-2642.png?v8"
	}, {
	  "name": "menorah",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f54e.png?v8"
	}, {
	  "name": "mens",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b9.png?v8"
	}, {
	  "name": "metal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f918.png?v8"
	}, {
	  "name": "metro",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f687.png?v8"
	}, {
	  "name": "mexico",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1fd.png?v8"
	}, {
	  "name": "micronesia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1eb-1f1f2.png?v8"
	}, {
	  "name": "microphone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a4.png?v8"
	}, {
	  "name": "microscope",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52c.png?v8"
	}, {
	  "name": "middle_finger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f595.png?v8"
	}, {
	  "name": "milk_glass",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f95b.png?v8"
	}, {
	  "name": "milky_way",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f30c.png?v8"
	}, {
	  "name": "minibus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f690.png?v8"
	}, {
	  "name": "minidisc",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4bd.png?v8"
	}, {
	  "name": "mobile_phone_off",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f4.png?v8"
	}, {
	  "name": "moldova",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1e9.png?v8"
	}, {
	  "name": "monaco",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1e8.png?v8"
	}, {
	  "name": "money_mouth_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f911.png?v8"
	}, {
	  "name": "money_with_wings",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b8.png?v8"
	}, {
	  "name": "moneybag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b0.png?v8"
	}, {
	  "name": "mongolia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f3.png?v8"
	}, {
	  "name": "monkey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f412.png?v8"
	}, {
	  "name": "monkey_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f435.png?v8"
	}, {
	  "name": "monorail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f69d.png?v8"
	}, {
	  "name": "montenegro",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1ea.png?v8"
	}, {
	  "name": "montserrat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f8.png?v8"
	}, {
	  "name": "moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f314.png?v8"
	}, {
	  "name": "morocco",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1e6.png?v8"
	}, {
	  "name": "mortar_board",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f393.png?v8"
	}, {
	  "name": "mosque",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f54c.png?v8"
	}, {
	  "name": "motor_boat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e5.png?v8"
	}, {
	  "name": "motor_scooter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6f5.png?v8"
	}, {
	  "name": "motorcycle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3cd.png?v8"
	}, {
	  "name": "motorway",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e3.png?v8"
	}, {
	  "name": "mount_fuji",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5fb.png?v8"
	}, {
	  "name": "mountain",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f0.png?v8"
	}, {
	  "name": "mountain_bicyclist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b5.png?v8"
	}, {
	  "name": "mountain_biking_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b5.png?v8"
	}, {
	  "name": "mountain_biking_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b5-2640.png?v8"
	}, {
	  "name": "mountain_cableway",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a0.png?v8"
	}, {
	  "name": "mountain_railway",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f69e.png?v8"
	}, {
	  "name": "mountain_snow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d4.png?v8"
	}, {
	  "name": "mouse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42d.png?v8"
	}, {
	  "name": "mouse2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f401.png?v8"
	}, {
	  "name": "movie_camera",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a5.png?v8"
	}, {
	  "name": "moyai",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5ff.png?v8"
	}, {
	  "name": "mozambique",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1ff.png?v8"
	}, {
	  "name": "mrs_claus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f936.png?v8"
	}, {
	  "name": "muscle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4aa.png?v8"
	}, {
	  "name": "mushroom",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f344.png?v8"
	}, {
	  "name": "musical_keyboard",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b9.png?v8"
	}, {
	  "name": "musical_note",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b5.png?v8"
	}, {
	  "name": "musical_score",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3bc.png?v8"
	}, {
	  "name": "mute",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f507.png?v8"
	}, {
	  "name": "myanmar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f2.png?v8"
	}, {
	  "name": "nail_care",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f485.png?v8"
	}, {
	  "name": "name_badge",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4db.png?v8"
	}, {
	  "name": "namibia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1e6.png?v8"
	}, {
	  "name": "national_park",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3de.png?v8"
	}, {
	  "name": "nauru",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1f7.png?v8"
	}, {
	  "name": "nauseated_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f922.png?v8"
	}, {
	  "name": "neckbeard",
	  "image": "https://github.githubassets.com/images/icons/emoji/neckbeard.png?v8"
	}, {
	  "name": "necktie",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f454.png?v8"
	}, {
	  "name": "negative_squared_cross_mark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/274e.png?v8"
	}, {
	  "name": "nepal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1f5.png?v8"
	}, {
	  "name": "nerd_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f913.png?v8"
	}, {
	  "name": "netherlands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1f1.png?v8"
	}, {
	  "name": "neutral_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f610.png?v8"
	}, {
	  "name": "new",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f195.png?v8"
	}, {
	  "name": "new_caledonia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1e8.png?v8"
	}, {
	  "name": "new_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f311.png?v8"
	}, {
	  "name": "new_moon_with_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f31a.png?v8"
	}, {
	  "name": "new_zealand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1ff.png?v8"
	}, {
	  "name": "newspaper",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f0.png?v8"
	}, {
	  "name": "newspaper_roll",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5de.png?v8"
	}, {
	  "name": "next_track_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23ed.png?v8"
	}, {
	  "name": "ng",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f196.png?v8"
	}, {
	  "name": "ng_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f645-2642.png?v8"
	}, {
	  "name": "ng_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f645.png?v8"
	}, {
	  "name": "nicaragua",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1ee.png?v8"
	}, {
	  "name": "niger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1ea.png?v8"
	}, {
	  "name": "nigeria",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1ec.png?v8"
	}, {
	  "name": "night_with_stars",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f303.png?v8"
	}, {
	  "name": "nine",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0039-20e3.png?v8"
	}, {
	  "name": "niue",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1fa.png?v8"
	}, {
	  "name": "no_bell",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f515.png?v8"
	}, {
	  "name": "no_bicycles",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b3.png?v8"
	}, {
	  "name": "no_entry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26d4.png?v8"
	}, {
	  "name": "no_entry_sign",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ab.png?v8"
	}, {
	  "name": "no_good",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f645.png?v8"
	}, {
	  "name": "no_good_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f645-2642.png?v8"
	}, {
	  "name": "no_good_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f645.png?v8"
	}, {
	  "name": "no_mobile_phones",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f5.png?v8"
	}, {
	  "name": "no_mouth",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f636.png?v8"
	}, {
	  "name": "no_pedestrians",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b7.png?v8"
	}, {
	  "name": "no_smoking",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ad.png?v8"
	}, {
	  "name": "non-potable_water",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b1.png?v8"
	}, {
	  "name": "norfolk_island",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1eb.png?v8"
	}, {
	  "name": "north_korea",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1f5.png?v8"
	}, {
	  "name": "northern_mariana_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f2-1f1f5.png?v8"
	}, {
	  "name": "norway",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f3-1f1f4.png?v8"
	}, {
	  "name": "nose",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f443.png?v8"
	}, {
	  "name": "notebook",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d3.png?v8"
	}, {
	  "name": "notebook_with_decorative_cover",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d4.png?v8"
	}, {
	  "name": "notes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b6.png?v8"
	}, {
	  "name": "nut_and_bolt",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f529.png?v8"
	}, {
	  "name": "o",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b55.png?v8"
	}, {
	  "name": "o2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f17e.png?v8"
	}, {
	  "name": "ocean",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f30a.png?v8"
	}, {
	  "name": "octocat",
	  "image": "https://github.githubassets.com/images/icons/emoji/octocat.png?v8"
	}, {
	  "name": "octopus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f419.png?v8"
	}, {
	  "name": "oden",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f362.png?v8"
	}, {
	  "name": "office",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e2.png?v8"
	}, {
	  "name": "oil_drum",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e2.png?v8"
	}, {
	  "name": "ok",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f197.png?v8"
	}, {
	  "name": "ok_hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44c.png?v8"
	}, {
	  "name": "ok_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f646-2642.png?v8"
	}, {
	  "name": "ok_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f646.png?v8"
	}, {
	  "name": "old_key",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5dd.png?v8"
	}, {
	  "name": "older_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f474.png?v8"
	}, {
	  "name": "older_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f475.png?v8"
	}, {
	  "name": "om",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f549.png?v8"
	}, {
	  "name": "oman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f4-1f1f2.png?v8"
	}, {
	  "name": "on",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f51b.png?v8"
	}, {
	  "name": "oncoming_automobile",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f698.png?v8"
	}, {
	  "name": "oncoming_bus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f68d.png?v8"
	}, {
	  "name": "oncoming_police_car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f694.png?v8"
	}, {
	  "name": "oncoming_taxi",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f696.png?v8"
	}, {
	  "name": "one",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0031-20e3.png?v8"
	}, {
	  "name": "open_book",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d6.png?v8"
	}, {
	  "name": "open_file_folder",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c2.png?v8"
	}, {
	  "name": "open_hands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f450.png?v8"
	}, {
	  "name": "open_mouth",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f62e.png?v8"
	}, {
	  "name": "open_umbrella",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2602.png?v8"
	}, {
	  "name": "ophiuchus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26ce.png?v8"
	}, {
	  "name": "orange",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34a.png?v8"
	}, {
	  "name": "orange_book",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d9.png?v8"
	}, {
	  "name": "orthodox_cross",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2626.png?v8"
	}, {
	  "name": "outbox_tray",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e4.png?v8"
	}, {
	  "name": "owl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f989.png?v8"
	}, {
	  "name": "ox",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f402.png?v8"
	}, {
	  "name": "package",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e6.png?v8"
	}, {
	  "name": "page_facing_up",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c4.png?v8"
	}, {
	  "name": "page_with_curl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4c3.png?v8"
	}, {
	  "name": "pager",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4df.png?v8"
	}, {
	  "name": "paintbrush",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f58c.png?v8"
	}, {
	  "name": "pakistan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f0.png?v8"
	}, {
	  "name": "palau",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1fc.png?v8"
	}, {
	  "name": "palestinian_territories",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f8.png?v8"
	}, {
	  "name": "palm_tree",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f334.png?v8"
	}, {
	  "name": "panama",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1e6.png?v8"
	}, {
	  "name": "pancakes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f95e.png?v8"
	}, {
	  "name": "panda_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43c.png?v8"
	}, {
	  "name": "paperclip",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ce.png?v8"
	}, {
	  "name": "paperclips",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f587.png?v8"
	}, {
	  "name": "papua_new_guinea",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1ec.png?v8"
	}, {
	  "name": "paraguay",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1fe.png?v8"
	}, {
	  "name": "parasol_on_ground",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f1.png?v8"
	}, {
	  "name": "parking",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f17f.png?v8"
	}, {
	  "name": "part_alternation_mark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/303d.png?v8"
	}, {
	  "name": "partly_sunny",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26c5.png?v8"
	}, {
	  "name": "passenger_ship",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6f3.png?v8"
	}, {
	  "name": "passport_control",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6c2.png?v8"
	}, {
	  "name": "pause_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23f8.png?v8"
	}, {
	  "name": "paw_prints",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43e.png?v8"
	}, {
	  "name": "peace_symbol",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/262e.png?v8"
	}, {
	  "name": "peach",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f351.png?v8"
	}, {
	  "name": "peanuts",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f95c.png?v8"
	}, {
	  "name": "pear",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f350.png?v8"
	}, {
	  "name": "pen",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f58a.png?v8"
	}, {
	  "name": "pencil",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4dd.png?v8"
	}, {
	  "name": "pencil2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270f.png?v8"
	}, {
	  "name": "penguin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f427.png?v8"
	}, {
	  "name": "pensive",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f614.png?v8"
	}, {
	  "name": "performing_arts",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ad.png?v8"
	}, {
	  "name": "persevere",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f623.png?v8"
	}, {
	  "name": "person_fencing",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93a.png?v8"
	}, {
	  "name": "person_frowning",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64d.png?v8"
	}, {
	  "name": "person_with_blond_hair",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f471.png?v8"
	}, {
	  "name": "person_with_pouting_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64e.png?v8"
	}, {
	  "name": "peru",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1ea.png?v8"
	}, {
	  "name": "philippines",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1ed.png?v8"
	}, {
	  "name": "phone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/260e.png?v8"
	}, {
	  "name": "pick",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26cf.png?v8"
	}, {
	  "name": "pig",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f437.png?v8"
	}, {
	  "name": "pig2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f416.png?v8"
	}, {
	  "name": "pig_nose",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43d.png?v8"
	}, {
	  "name": "pill",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f48a.png?v8"
	}, {
	  "name": "pineapple",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34d.png?v8"
	}, {
	  "name": "ping_pong",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d3.png?v8"
	}, {
	  "name": "pisces",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2653.png?v8"
	}, {
	  "name": "pitcairn_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f3.png?v8"
	}, {
	  "name": "pizza",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f355.png?v8"
	}, {
	  "name": "place_of_worship",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6d0.png?v8"
	}, {
	  "name": "plate_with_cutlery",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f37d.png?v8"
	}, {
	  "name": "play_or_pause_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23ef.png?v8"
	}, {
	  "name": "point_down",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f447.png?v8"
	}, {
	  "name": "point_left",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f448.png?v8"
	}, {
	  "name": "point_right",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f449.png?v8"
	}, {
	  "name": "point_up",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/261d.png?v8"
	}, {
	  "name": "point_up_2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f446.png?v8"
	}, {
	  "name": "poland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f1.png?v8"
	}, {
	  "name": "police_car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f693.png?v8"
	}, {
	  "name": "policeman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46e.png?v8"
	}, {
	  "name": "policewoman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46e-2640.png?v8"
	}, {
	  "name": "poodle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f429.png?v8"
	}, {
	  "name": "poop",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a9.png?v8"
	}, {
	  "name": "popcorn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f37f.png?v8"
	}, {
	  "name": "portugal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f9.png?v8"
	}, {
	  "name": "post_office",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3e3.png?v8"
	}, {
	  "name": "postal_horn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ef.png?v8"
	}, {
	  "name": "postbox",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ee.png?v8"
	}, {
	  "name": "potable_water",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b0.png?v8"
	}, {
	  "name": "potato",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f954.png?v8"
	}, {
	  "name": "pouch",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45d.png?v8"
	}, {
	  "name": "poultry_leg",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f357.png?v8"
	}, {
	  "name": "pound",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b7.png?v8"
	}, {
	  "name": "pout",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f621.png?v8"
	}, {
	  "name": "pouting_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f63e.png?v8"
	}, {
	  "name": "pouting_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64e-2642.png?v8"
	}, {
	  "name": "pouting_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64e.png?v8"
	}, {
	  "name": "pray",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64f.png?v8"
	}, {
	  "name": "prayer_beads",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ff.png?v8"
	}, {
	  "name": "pregnant_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f930.png?v8"
	}, {
	  "name": "previous_track_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23ee.png?v8"
	}, {
	  "name": "prince",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f934.png?v8"
	}, {
	  "name": "princess",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f478.png?v8"
	}, {
	  "name": "printer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5a8.png?v8"
	}, {
	  "name": "puerto_rico",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f7.png?v8"
	}, {
	  "name": "punch",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44a.png?v8"
	}, {
	  "name": "purple_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f49c.png?v8"
	}, {
	  "name": "purse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45b.png?v8"
	}, {
	  "name": "pushpin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4cc.png?v8"
	}, {
	  "name": "put_litter_in_its_place",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ae.png?v8"
	}, {
	  "name": "qatar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f6-1f1e6.png?v8"
	}, {
	  "name": "question",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2753.png?v8"
	}, {
	  "name": "rabbit",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f430.png?v8"
	}, {
	  "name": "rabbit2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f407.png?v8"
	}, {
	  "name": "racehorse",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f40e.png?v8"
	}, {
	  "name": "racing_car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ce.png?v8"
	}, {
	  "name": "radio",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4fb.png?v8"
	}, {
	  "name": "radio_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f518.png?v8"
	}, {
	  "name": "radioactive",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2622.png?v8"
	}, {
	  "name": "rage",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f621.png?v8"
	}, {
	  "name": "rage1",
	  "image": "https://github.githubassets.com/images/icons/emoji/rage1.png?v8"
	}, {
	  "name": "rage2",
	  "image": "https://github.githubassets.com/images/icons/emoji/rage2.png?v8"
	}, {
	  "name": "rage3",
	  "image": "https://github.githubassets.com/images/icons/emoji/rage3.png?v8"
	}, {
	  "name": "rage4",
	  "image": "https://github.githubassets.com/images/icons/emoji/rage4.png?v8"
	}, {
	  "name": "railway_car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f683.png?v8"
	}, {
	  "name": "railway_track",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e4.png?v8"
	}, {
	  "name": "rainbow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f308.png?v8"
	}, {
	  "name": "rainbow_flag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f3-1f308.png?v8"
	}, {
	  "name": "raised_back_of_hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f91a.png?v8"
	}, {
	  "name": "raised_hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270b.png?v8"
	}, {
	  "name": "raised_hand_with_fingers_splayed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f590.png?v8"
	}, {
	  "name": "raised_hands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64c.png?v8"
	}, {
	  "name": "raising_hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64b.png?v8"
	}, {
	  "name": "raising_hand_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64b-2642.png?v8"
	}, {
	  "name": "raising_hand_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64b.png?v8"
	}, {
	  "name": "ram",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f40f.png?v8"
	}, {
	  "name": "ramen",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f35c.png?v8"
	}, {
	  "name": "rat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f400.png?v8"
	}, {
	  "name": "record_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23fa.png?v8"
	}, {
	  "name": "recycle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/267b.png?v8"
	}, {
	  "name": "red_car",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f697.png?v8"
	}, {
	  "name": "red_circle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f534.png?v8"
	}, {
	  "name": "registered",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/00ae.png?v8"
	}, {
	  "name": "relaxed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/263a.png?v8"
	}, {
	  "name": "relieved",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f60c.png?v8"
	}, {
	  "name": "reminder_ribbon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f397.png?v8"
	}, {
	  "name": "repeat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f501.png?v8"
	}, {
	  "name": "repeat_one",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f502.png?v8"
	}, {
	  "name": "rescue_worker_helmet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26d1.png?v8"
	}, {
	  "name": "restroom",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6bb.png?v8"
	}, {
	  "name": "reunion",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f7-1f1ea.png?v8"
	}, {
	  "name": "revolving_hearts",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f49e.png?v8"
	}, {
	  "name": "rewind",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23ea.png?v8"
	}, {
	  "name": "rhinoceros",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f98f.png?v8"
	}, {
	  "name": "ribbon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f380.png?v8"
	}, {
	  "name": "rice",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f35a.png?v8"
	}, {
	  "name": "rice_ball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f359.png?v8"
	}, {
	  "name": "rice_cracker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f358.png?v8"
	}, {
	  "name": "rice_scene",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f391.png?v8"
	}, {
	  "name": "right_anger_bubble",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5ef.png?v8"
	}, {
	  "name": "ring",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f48d.png?v8"
	}, {
	  "name": "robot",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f916.png?v8"
	}, {
	  "name": "rocket",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f680.png?v8"
	}, {
	  "name": "rofl",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f923.png?v8"
	}, {
	  "name": "roll_eyes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f644.png?v8"
	}, {
	  "name": "roller_coaster",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a2.png?v8"
	}, {
	  "name": "romania",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f7-1f1f4.png?v8"
	}, {
	  "name": "rooster",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f413.png?v8"
	}, {
	  "name": "rose",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f339.png?v8"
	}, {
	  "name": "rosette",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f5.png?v8"
	}, {
	  "name": "rotating_light",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a8.png?v8"
	}, {
	  "name": "round_pushpin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4cd.png?v8"
	}, {
	  "name": "rowboat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a3.png?v8"
	}, {
	  "name": "rowing_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a3.png?v8"
	}, {
	  "name": "rowing_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a3-2640.png?v8"
	}, {
	  "name": "ru",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f7-1f1fa.png?v8"
	}, {
	  "name": "rugby_football",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c9.png?v8"
	}, {
	  "name": "runner",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c3.png?v8"
	}, {
	  "name": "running",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c3.png?v8"
	}, {
	  "name": "running_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c3.png?v8"
	}, {
	  "name": "running_shirt_with_sash",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3bd.png?v8"
	}, {
	  "name": "running_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c3-2640.png?v8"
	}, {
	  "name": "rwanda",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f7-1f1fc.png?v8"
	}, {
	  "name": "sa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f202.png?v8"
	}, {
	  "name": "sagittarius",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2650.png?v8"
	}, {
	  "name": "sailboat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f5.png?v8"
	}, {
	  "name": "sake",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f376.png?v8"
	}, {
	  "name": "samoa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fc-1f1f8.png?v8"
	}, {
	  "name": "san_marino",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f2.png?v8"
	}, {
	  "name": "sandal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f461.png?v8"
	}, {
	  "name": "santa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f385.png?v8"
	}, {
	  "name": "sao_tome_principe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f9.png?v8"
	}, {
	  "name": "sassy_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f481-2642.png?v8"
	}, {
	  "name": "sassy_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f481.png?v8"
	}, {
	  "name": "satellite",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4e1.png?v8"
	}, {
	  "name": "satisfied",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f606.png?v8"
	}, {
	  "name": "saudi_arabia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1e6.png?v8"
	}, {
	  "name": "saxophone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b7.png?v8"
	}, {
	  "name": "school",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3eb.png?v8"
	}, {
	  "name": "school_satchel",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f392.png?v8"
	}, {
	  "name": "scissors",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2702.png?v8"
	}, {
	  "name": "scorpion",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f982.png?v8"
	}, {
	  "name": "scorpius",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/264f.png?v8"
	}, {
	  "name": "scream",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f631.png?v8"
	}, {
	  "name": "scream_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f640.png?v8"
	}, {
	  "name": "scroll",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4dc.png?v8"
	}, {
	  "name": "seat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ba.png?v8"
	}, {
	  "name": "secret",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/3299.png?v8"
	}, {
	  "name": "see_no_evil",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f648.png?v8"
	}, {
	  "name": "seedling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f331.png?v8"
	}, {
	  "name": "selfie",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f933.png?v8"
	}, {
	  "name": "senegal",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f3.png?v8"
	}, {
	  "name": "serbia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f7-1f1f8.png?v8"
	}, {
	  "name": "seven",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0037-20e3.png?v8"
	}, {
	  "name": "seychelles",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1e8.png?v8"
	}, {
	  "name": "shallow_pan_of_food",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f958.png?v8"
	}, {
	  "name": "shamrock",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2618.png?v8"
	}, {
	  "name": "shark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f988.png?v8"
	}, {
	  "name": "shaved_ice",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f367.png?v8"
	}, {
	  "name": "sheep",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f411.png?v8"
	}, {
	  "name": "shell",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f41a.png?v8"
	}, {
	  "name": "shield",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e1.png?v8"
	}, {
	  "name": "shinto_shrine",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26e9.png?v8"
	}, {
	  "name": "ship",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a2.png?v8"
	}, {
	  "name": "shipit",
	  "image": "https://github.githubassets.com/images/icons/emoji/shipit.png?v8"
	}, {
	  "name": "shirt",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f455.png?v8"
	}, {
	  "name": "shit",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a9.png?v8"
	}, {
	  "name": "shoe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45e.png?v8"
	}, {
	  "name": "shopping",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6cd.png?v8"
	}, {
	  "name": "shopping_cart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6d2.png?v8"
	}, {
	  "name": "shower",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6bf.png?v8"
	}, {
	  "name": "shrimp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f990.png?v8"
	}, {
	  "name": "sierra_leone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f1.png?v8"
	}, {
	  "name": "signal_strength",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f6.png?v8"
	}, {
	  "name": "singapore",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1ec.png?v8"
	}, {
	  "name": "sint_maarten",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1fd.png?v8"
	}, {
	  "name": "six",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0036-20e3.png?v8"
	}, {
	  "name": "six_pointed_star",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52f.png?v8"
	}, {
	  "name": "ski",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3bf.png?v8"
	}, {
	  "name": "skier",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26f7.png?v8"
	}, {
	  "name": "skull",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f480.png?v8"
	}, {
	  "name": "skull_and_crossbones",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2620.png?v8"
	}, {
	  "name": "sleeping",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f634.png?v8"
	}, {
	  "name": "sleeping_bed",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6cc.png?v8"
	}, {
	  "name": "sleepy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f62a.png?v8"
	}, {
	  "name": "slightly_frowning_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f641.png?v8"
	}, {
	  "name": "slightly_smiling_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f642.png?v8"
	}, {
	  "name": "slot_machine",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3b0.png?v8"
	}, {
	  "name": "slovakia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f0.png?v8"
	}, {
	  "name": "slovenia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1ee.png?v8"
	}, {
	  "name": "small_airplane",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6e9.png?v8"
	}, {
	  "name": "small_blue_diamond",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f539.png?v8"
	}, {
	  "name": "small_orange_diamond",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f538.png?v8"
	}, {
	  "name": "small_red_triangle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f53a.png?v8"
	}, {
	  "name": "small_red_triangle_down",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f53b.png?v8"
	}, {
	  "name": "smile",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f604.png?v8"
	}, {
	  "name": "smile_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f638.png?v8"
	}, {
	  "name": "smiley",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f603.png?v8"
	}, {
	  "name": "smiley_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f63a.png?v8"
	}, {
	  "name": "smiling_imp",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f608.png?v8"
	}, {
	  "name": "smirk",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f60f.png?v8"
	}, {
	  "name": "smirk_cat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f63c.png?v8"
	}, {
	  "name": "smoking",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ac.png?v8"
	}, {
	  "name": "snail",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f40c.png?v8"
	}, {
	  "name": "snake",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f40d.png?v8"
	}, {
	  "name": "sneezing_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f927.png?v8"
	}, {
	  "name": "snowboarder",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c2.png?v8"
	}, {
	  "name": "snowflake",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2744.png?v8"
	}, {
	  "name": "snowman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26c4.png?v8"
	}, {
	  "name": "snowman_with_snow",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2603.png?v8"
	}, {
	  "name": "sob",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f62d.png?v8"
	}, {
	  "name": "soccer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26bd.png?v8"
	}, {
	  "name": "solomon_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1e7.png?v8"
	}, {
	  "name": "somalia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f4.png?v8"
	}, {
	  "name": "soon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f51c.png?v8"
	}, {
	  "name": "sos",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f198.png?v8"
	}, {
	  "name": "sound",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f509.png?v8"
	}, {
	  "name": "south_africa",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ff-1f1e6.png?v8"
	}, {
	  "name": "south_georgia_south_sandwich_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1f8.png?v8"
	}, {
	  "name": "south_sudan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f8.png?v8"
	}, {
	  "name": "space_invader",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f47e.png?v8"
	}, {
	  "name": "spades",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2660.png?v8"
	}, {
	  "name": "spaghetti",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f35d.png?v8"
	}, {
	  "name": "sparkle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2747.png?v8"
	}, {
	  "name": "sparkler",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f387.png?v8"
	}, {
	  "name": "sparkles",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2728.png?v8"
	}, {
	  "name": "sparkling_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f496.png?v8"
	}, {
	  "name": "speak_no_evil",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f64a.png?v8"
	}, {
	  "name": "speaker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f508.png?v8"
	}, {
	  "name": "speaking_head",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5e3.png?v8"
	}, {
	  "name": "speech_balloon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ac.png?v8"
	}, {
	  "name": "speedboat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a4.png?v8"
	}, {
	  "name": "spider",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f577.png?v8"
	}, {
	  "name": "spider_web",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f578.png?v8"
	}, {
	  "name": "spiral_calendar",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5d3.png?v8"
	}, {
	  "name": "spiral_notepad",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5d2.png?v8"
	}, {
	  "name": "spoon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f944.png?v8"
	}, {
	  "name": "squid",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f991.png?v8"
	}, {
	  "name": "squirrel",
	  "image": "https://github.githubassets.com/images/icons/emoji/shipit.png?v8"
	}, {
	  "name": "sri_lanka",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1f0.png?v8"
	}, {
	  "name": "st_barthelemy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e7-1f1f1.png?v8"
	}, {
	  "name": "st_helena",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1ed.png?v8"
	}, {
	  "name": "st_kitts_nevis",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f0-1f1f3.png?v8"
	}, {
	  "name": "st_lucia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f1-1f1e8.png?v8"
	}, {
	  "name": "st_pierre_miquelon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f5-1f1f2.png?v8"
	}, {
	  "name": "st_vincent_grenadines",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1e8.png?v8"
	}, {
	  "name": "stadium",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3df.png?v8"
	}, {
	  "name": "star",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b50.png?v8"
	}, {
	  "name": "star2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f31f.png?v8"
	}, {
	  "name": "star_and_crescent",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/262a.png?v8"
	}, {
	  "name": "star_of_david",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2721.png?v8"
	}, {
	  "name": "stars",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f320.png?v8"
	}, {
	  "name": "station",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f689.png?v8"
	}, {
	  "name": "statue_of_liberty",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5fd.png?v8"
	}, {
	  "name": "steam_locomotive",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f682.png?v8"
	}, {
	  "name": "stew",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f372.png?v8"
	}, {
	  "name": "stop_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23f9.png?v8"
	}, {
	  "name": "stop_sign",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6d1.png?v8"
	}, {
	  "name": "stopwatch",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23f1.png?v8"
	}, {
	  "name": "straight_ruler",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4cf.png?v8"
	}, {
	  "name": "strawberry",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f353.png?v8"
	}, {
	  "name": "stuck_out_tongue",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f61b.png?v8"
	}, {
	  "name": "stuck_out_tongue_closed_eyes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f61d.png?v8"
	}, {
	  "name": "stuck_out_tongue_winking_eye",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f61c.png?v8"
	}, {
	  "name": "studio_microphone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f399.png?v8"
	}, {
	  "name": "stuffed_flatbread",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f959.png?v8"
	}, {
	  "name": "sudan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1e9.png?v8"
	}, {
	  "name": "sun_behind_large_cloud",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f325.png?v8"
	}, {
	  "name": "sun_behind_rain_cloud",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f326.png?v8"
	}, {
	  "name": "sun_behind_small_cloud",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f324.png?v8"
	}, {
	  "name": "sun_with_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f31e.png?v8"
	}, {
	  "name": "sunflower",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f33b.png?v8"
	}, {
	  "name": "sunglasses",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f60e.png?v8"
	}, {
	  "name": "sunny",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2600.png?v8"
	}, {
	  "name": "sunrise",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f305.png?v8"
	}, {
	  "name": "sunrise_over_mountains",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f304.png?v8"
	}, {
	  "name": "surfer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c4.png?v8"
	}, {
	  "name": "surfing_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c4.png?v8"
	}, {
	  "name": "surfing_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c4-2640.png?v8"
	}, {
	  "name": "suriname",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1f7.png?v8"
	}, {
	  "name": "sushi",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f363.png?v8"
	}, {
	  "name": "suspect",
	  "image": "https://github.githubassets.com/images/icons/emoji/suspect.png?v8"
	}, {
	  "name": "suspension_railway",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f69f.png?v8"
	}, {
	  "name": "swaziland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1ff.png?v8"
	}, {
	  "name": "sweat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f613.png?v8"
	}, {
	  "name": "sweat_drops",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a6.png?v8"
	}, {
	  "name": "sweat_smile",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f605.png?v8"
	}, {
	  "name": "sweden",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1ea.png?v8"
	}, {
	  "name": "sweet_potato",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f360.png?v8"
	}, {
	  "name": "swimmer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ca.png?v8"
	}, {
	  "name": "swimming_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ca.png?v8"
	}, {
	  "name": "swimming_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ca-2640.png?v8"
	}, {
	  "name": "switzerland",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e8-1f1ed.png?v8"
	}, {
	  "name": "symbols",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f523.png?v8"
	}, {
	  "name": "synagogue",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f54d.png?v8"
	}, {
	  "name": "syria",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f8-1f1fe.png?v8"
	}, {
	  "name": "syringe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f489.png?v8"
	}, {
	  "name": "taco",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f32e.png?v8"
	}, {
	  "name": "tada",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f389.png?v8"
	}, {
	  "name": "taiwan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1fc.png?v8"
	}, {
	  "name": "tajikistan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1ef.png?v8"
	}, {
	  "name": "tanabata_tree",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f38b.png?v8"
	}, {
	  "name": "tangerine",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f34a.png?v8"
	}, {
	  "name": "tanzania",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1ff.png?v8"
	}, {
	  "name": "taurus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2649.png?v8"
	}, {
	  "name": "taxi",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f695.png?v8"
	}, {
	  "name": "tea",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f375.png?v8"
	}, {
	  "name": "telephone",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/260e.png?v8"
	}, {
	  "name": "telephone_receiver",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4de.png?v8"
	}, {
	  "name": "telescope",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f52d.png?v8"
	}, {
	  "name": "tennis",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3be.png?v8"
	}, {
	  "name": "tent",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26fa.png?v8"
	}, {
	  "name": "thailand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1ed.png?v8"
	}, {
	  "name": "thermometer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f321.png?v8"
	}, {
	  "name": "thinking",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f914.png?v8"
	}, {
	  "name": "thought_balloon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ad.png?v8"
	}, {
	  "name": "three",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0033-20e3.png?v8"
	}, {
	  "name": "thumbsdown",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44e.png?v8"
	}, {
	  "name": "thumbsup",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44d.png?v8"
	}, {
	  "name": "ticket",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ab.png?v8"
	}, {
	  "name": "tickets",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f39f.png?v8"
	}, {
	  "name": "tiger",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f42f.png?v8"
	}, {
	  "name": "tiger2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f405.png?v8"
	}, {
	  "name": "timer_clock",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/23f2.png?v8"
	}, {
	  "name": "timor_leste",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f1.png?v8"
	}, {
	  "name": "tipping_hand_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f481-2642.png?v8"
	}, {
	  "name": "tipping_hand_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f481.png?v8"
	}, {
	  "name": "tired_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f62b.png?v8"
	}, {
	  "name": "tm",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2122.png?v8"
	}, {
	  "name": "togo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1ec.png?v8"
	}, {
	  "name": "toilet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6bd.png?v8"
	}, {
	  "name": "tokelau",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f0.png?v8"
	}, {
	  "name": "tokyo_tower",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5fc.png?v8"
	}, {
	  "name": "tomato",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f345.png?v8"
	}, {
	  "name": "tonga",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f4.png?v8"
	}, {
	  "name": "tongue",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f445.png?v8"
	}, {
	  "name": "top",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f51d.png?v8"
	}, {
	  "name": "tophat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3a9.png?v8"
	}, {
	  "name": "tornado",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f32a.png?v8"
	}, {
	  "name": "tr",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f7.png?v8"
	}, {
	  "name": "trackball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5b2.png?v8"
	}, {
	  "name": "tractor",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f69c.png?v8"
	}, {
	  "name": "traffic_light",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a5.png?v8"
	}, {
	  "name": "train",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f68b.png?v8"
	}, {
	  "name": "train2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f686.png?v8"
	}, {
	  "name": "tram",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f68a.png?v8"
	}, {
	  "name": "triangular_flag_on_post",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a9.png?v8"
	}, {
	  "name": "triangular_ruler",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4d0.png?v8"
	}, {
	  "name": "trident",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f531.png?v8"
	}, {
	  "name": "trinidad_tobago",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f9.png?v8"
	}, {
	  "name": "triumph",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f624.png?v8"
	}, {
	  "name": "trolleybus",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f68e.png?v8"
	}, {
	  "name": "trollface",
	  "image": "https://github.githubassets.com/images/icons/emoji/trollface.png?v8"
	}, {
	  "name": "trophy",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3c6.png?v8"
	}, {
	  "name": "tropical_drink",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f379.png?v8"
	}, {
	  "name": "tropical_fish",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f420.png?v8"
	}, {
	  "name": "truck",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f69a.png?v8"
	}, {
	  "name": "trumpet",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ba.png?v8"
	}, {
	  "name": "tshirt",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f455.png?v8"
	}, {
	  "name": "tulip",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f337.png?v8"
	}, {
	  "name": "tumbler_glass",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f943.png?v8"
	}, {
	  "name": "tunisia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f3.png?v8"
	}, {
	  "name": "turkey",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f983.png?v8"
	}, {
	  "name": "turkmenistan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1f2.png?v8"
	}, {
	  "name": "turks_caicos_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1e8.png?v8"
	}, {
	  "name": "turtle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f422.png?v8"
	}, {
	  "name": "tuvalu",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1f9-1f1fb.png?v8"
	}, {
	  "name": "tv",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4fa.png?v8"
	}, {
	  "name": "twisted_rightwards_arrows",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f500.png?v8"
	}, {
	  "name": "two",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0032-20e3.png?v8"
	}, {
	  "name": "two_hearts",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f495.png?v8"
	}, {
	  "name": "two_men_holding_hands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46c.png?v8"
	}, {
	  "name": "two_women_holding_hands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f46d.png?v8"
	}, {
	  "name": "u5272",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f239.png?v8"
	}, {
	  "name": "u5408",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f234.png?v8"
	}, {
	  "name": "u55b6",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f23a.png?v8"
	}, {
	  "name": "u6307",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f22f.png?v8"
	}, {
	  "name": "u6708",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f237.png?v8"
	}, {
	  "name": "u6709",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f236.png?v8"
	}, {
	  "name": "u6e80",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f235.png?v8"
	}, {
	  "name": "u7121",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f21a.png?v8"
	}, {
	  "name": "u7533",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f238.png?v8"
	}, {
	  "name": "u7981",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f232.png?v8"
	}, {
	  "name": "u7a7a",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f233.png?v8"
	}, {
	  "name": "uganda",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fa-1f1ec.png?v8"
	}, {
	  "name": "uk",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ec-1f1e7.png?v8"
	}, {
	  "name": "ukraine",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fa-1f1e6.png?v8"
	}, {
	  "name": "umbrella",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2614.png?v8"
	}, {
	  "name": "unamused",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f612.png?v8"
	}, {
	  "name": "underage",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f51e.png?v8"
	}, {
	  "name": "unicorn",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f984.png?v8"
	}, {
	  "name": "united_arab_emirates",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1e6-1f1ea.png?v8"
	}, {
	  "name": "unlock",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f513.png?v8"
	}, {
	  "name": "up",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f199.png?v8"
	}, {
	  "name": "upside_down_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f643.png?v8"
	}, {
	  "name": "uruguay",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fa-1f1fe.png?v8"
	}, {
	  "name": "us",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fa-1f1f8.png?v8"
	}, {
	  "name": "us_virgin_islands",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1ee.png?v8"
	}, {
	  "name": "uzbekistan",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fa-1f1ff.png?v8"
	}, {
	  "name": "v",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270c.png?v8"
	}, {
	  "name": "vanuatu",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1fa.png?v8"
	}, {
	  "name": "vatican_city",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1e6.png?v8"
	}, {
	  "name": "venezuela",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1ea.png?v8"
	}, {
	  "name": "vertical_traffic_light",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6a6.png?v8"
	}, {
	  "name": "vhs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4fc.png?v8"
	}, {
	  "name": "vibration_mode",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f3.png?v8"
	}, {
	  "name": "video_camera",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4f9.png?v8"
	}, {
	  "name": "video_game",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3ae.png?v8"
	}, {
	  "name": "vietnam",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fb-1f1f3.png?v8"
	}, {
	  "name": "violin",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3bb.png?v8"
	}, {
	  "name": "virgo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/264d.png?v8"
	}, {
	  "name": "volcano",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f30b.png?v8"
	}, {
	  "name": "volleyball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3d0.png?v8"
	}, {
	  "name": "vs",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f19a.png?v8"
	}, {
	  "name": "vulcan_salute",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f596.png?v8"
	}, {
	  "name": "walking",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b6.png?v8"
	}, {
	  "name": "walking_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b6.png?v8"
	}, {
	  "name": "walking_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6b6-2640.png?v8"
	}, {
	  "name": "wallis_futuna",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fc-1f1eb.png?v8"
	}, {
	  "name": "waning_crescent_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f318.png?v8"
	}, {
	  "name": "waning_gibbous_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f316.png?v8"
	}, {
	  "name": "warning",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26a0.png?v8"
	}, {
	  "name": "wastebasket",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5d1.png?v8"
	}, {
	  "name": "watch",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/231a.png?v8"
	}, {
	  "name": "water_buffalo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f403.png?v8"
	}, {
	  "name": "watermelon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f349.png?v8"
	}, {
	  "name": "wave",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f44b.png?v8"
	}, {
	  "name": "wavy_dash",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/3030.png?v8"
	}, {
	  "name": "waxing_crescent_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f312.png?v8"
	}, {
	  "name": "waxing_gibbous_moon",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f314.png?v8"
	}, {
	  "name": "wc",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6be.png?v8"
	}, {
	  "name": "weary",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f629.png?v8"
	}, {
	  "name": "wedding",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f492.png?v8"
	}, {
	  "name": "weight_lifting_man",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3cb.png?v8"
	}, {
	  "name": "weight_lifting_woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3cb-2640.png?v8"
	}, {
	  "name": "western_sahara",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ea-1f1ed.png?v8"
	}, {
	  "name": "whale",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f433.png?v8"
	}, {
	  "name": "whale2",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f40b.png?v8"
	}, {
	  "name": "wheel_of_dharma",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2638.png?v8"
	}, {
	  "name": "wheelchair",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/267f.png?v8"
	}, {
	  "name": "white_check_mark",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2705.png?v8"
	}, {
	  "name": "white_circle",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26aa.png?v8"
	}, {
	  "name": "white_flag",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f3f3.png?v8"
	}, {
	  "name": "white_flower",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4ae.png?v8"
	}, {
	  "name": "white_large_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/2b1c.png?v8"
	}, {
	  "name": "white_medium_small_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25fd.png?v8"
	}, {
	  "name": "white_medium_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25fb.png?v8"
	}, {
	  "name": "white_small_square",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/25ab.png?v8"
	}, {
	  "name": "white_square_button",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f533.png?v8"
	}, {
	  "name": "wilted_flower",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f940.png?v8"
	}, {
	  "name": "wind_chime",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f390.png?v8"
	}, {
	  "name": "wind_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f32c.png?v8"
	}, {
	  "name": "wine_glass",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f377.png?v8"
	}, {
	  "name": "wink",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f609.png?v8"
	}, {
	  "name": "wolf",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f43a.png?v8"
	}, {
	  "name": "woman",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469.png?v8"
	}, {
	  "name": "woman_artist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f3a8.png?v8"
	}, {
	  "name": "woman_astronaut",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f680.png?v8"
	}, {
	  "name": "woman_cartwheeling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f938-2640.png?v8"
	}, {
	  "name": "woman_cook",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f373.png?v8"
	}, {
	  "name": "woman_facepalming",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f926-2640.png?v8"
	}, {
	  "name": "woman_factory_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f3ed.png?v8"
	}, {
	  "name": "woman_farmer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f33e.png?v8"
	}, {
	  "name": "woman_firefighter",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f692.png?v8"
	}, {
	  "name": "woman_health_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-2695.png?v8"
	}, {
	  "name": "woman_judge",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-2696.png?v8"
	}, {
	  "name": "woman_juggling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f939-2640.png?v8"
	}, {
	  "name": "woman_mechanic",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f527.png?v8"
	}, {
	  "name": "woman_office_worker",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f4bc.png?v8"
	}, {
	  "name": "woman_pilot",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-2708.png?v8"
	}, {
	  "name": "woman_playing_handball",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93e-2640.png?v8"
	}, {
	  "name": "woman_playing_water_polo",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93d-2640.png?v8"
	}, {
	  "name": "woman_scientist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f52c.png?v8"
	}, {
	  "name": "woman_shrugging",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f937-2640.png?v8"
	}, {
	  "name": "woman_singer",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f3a4.png?v8"
	}, {
	  "name": "woman_student",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f393.png?v8"
	}, {
	  "name": "woman_teacher",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f3eb.png?v8"
	}, {
	  "name": "woman_technologist",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f469-1f4bb.png?v8"
	}, {
	  "name": "woman_with_turban",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f473-2640.png?v8"
	}, {
	  "name": "womans_clothes",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f45a.png?v8"
	}, {
	  "name": "womans_hat",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f452.png?v8"
	}, {
	  "name": "women_wrestling",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f93c-2640.png?v8"
	}, {
	  "name": "womens",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f6ba.png?v8"
	}, {
	  "name": "world_map",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f5fa.png?v8"
	}, {
	  "name": "worried",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f61f.png?v8"
	}, {
	  "name": "wrench",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f527.png?v8"
	}, {
	  "name": "writing_hand",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/270d.png?v8"
	}, {
	  "name": "x",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/274c.png?v8"
	}, {
	  "name": "yellow_heart",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f49b.png?v8"
	}, {
	  "name": "yemen",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1fe-1f1ea.png?v8"
	}, {
	  "name": "yen",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4b4.png?v8"
	}, {
	  "name": "yin_yang",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/262f.png?v8"
	}, {
	  "name": "yum",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f60b.png?v8"
	}, {
	  "name": "zambia",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ff-1f1f2.png?v8"
	}, {
	  "name": "zap",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/26a1.png?v8"
	}, {
	  "name": "zero",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/0030-20e3.png?v8"
	}, {
	  "name": "zimbabwe",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f1ff-1f1fc.png?v8"
	}, {
	  "name": "zipper_mouth_face",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f910.png?v8"
	}, {
	  "name": "zzz",
	  "image": "https://github.githubassets.com/images/icons/emoji/unicode/1f4a4.png?v8"
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
	    let {
	      name
	    } = _ref,
	        rest = _objectWithoutProperties(_ref, ["name"]);

	    return _objectSpread({
	      name,
	      sorting: name.indexOf(normalizedQuery)
	    }, rest);
	  }).filter((_ref2) => {
	    let {
	      sorting
	    } = _ref2;
	    return sorting !== -1;
	  }).sort((a, b) => compareNumbers(a.sorting, b.sorting));
	};

	class EmojiApp extends Component {
	  constructor() {
	    super();
	    this.state.query = '';
	  }

	  render(_ref3, _ref4) {
	    let {
	      query
	    } = _ref4;
	    return h("main", {
	      class: "page-wrap"
	    }, h(EmojiSearch, {
	      onSearch: query => this.setState({
	        query
	      })
	    }), h(EmojiList, {
	      items: filterItems(emojis, query)
	    }));
	  }

	}

	render(h(EmojiApp, null), document.body);

}());
