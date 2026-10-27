(function(modules) {
  var __serpack_module_cache__={};
  function __serpack_require__(id){
    if (!id.startsWith("sp:")) return require(id);
    if (__serpack_module_cache__[id.slice(3)]) return __serpack_module_cache__[id.slice(3)];
    const module={exports:{}};
    __serpack_module_cache__[id.slice(3)]="__serpack_module_pending__";
    modules[id.slice(3)].call(module.exports, __serpack_require__, require, module, module.exports);
    __serpack_module_cache__[id.slice(3)]=module.exports;
    return module.exports;
  }
  module.exports=__serpack_require__("sp:0");
})({
/* D:\nudo\scripts\build.ts */ "0": (function(__serpack_require__,__non_serpack_require__,module,exports) { Object.defineProperty(exports, "__esModule", {
  value: !0
});
const e = __serpack_require__("esbuild"), r = __serpack_require__("esbuild-node-externals"), t = __serpack_require__("node:fs"), n = (function (e, r) {
  if (e && e.__esModule) return e;
  if (null === e || "object" != typeof e && "function" != typeof e) return {
    default: e
  };
  var t = c(r);
  if (t && t.has(e)) return t.get(e);
  var n = {
    __proto__: null
  }, o = Object.defineProperty && Object.getOwnPropertyDescriptor;
  for (var i in e) if ("default" !== i && Object.prototype.hasOwnProperty.call(e, i)) {
    var s = o ? Object.getOwnPropertyDescriptor(e, i) : null;
    s && (s.get || s.set) ? Object.defineProperty(n, i, s) : n[i] = e[i];
  }
  return (n.default = e, t && t.set(e, n), n);
})(__serpack_require__("glob")), o = __serpack_require__("node:path"), i = __serpack_require__('sp:1');
function c(e) {
  if ("function" != typeof WeakMap) return null;
  var r = new WeakMap(), t = new WeakMap();
  return (c = function (e) {
    return e ? t : r;
  })(e);
}
const s = n.globSync(['packages/**/*/build.json']), u = !process.argv.includes('--dev');
for (const n of s) {
  console.log(`> ${((0, o.join))(process.cwd(), n)}`);
  let c = JSON.parse(((0, t.readFileSync))(((0, o.join))(process.cwd(), n), 'utf-8')), s = ((0, o.dirname))(n), a = ((0, o.join))(s, 'dist'), l = ((0, o.join))(s, 'types');
  (((0, t.existsSync))(a) && ((0, t.rmSync))(a, {
    recursive: !0,
    force: !0
  }), ((0, t.existsSync))(l) && ((0, t.rmSync))(l, {
    recursive: !0,
    force: !0
  }));
  let p = {
    entryPoints: c.map(e => ((0, o.join))(s, e)),
    logLevel: 'info',
    platform: 'node',
    outbase: ((0, o.join))(s, './src'),
    outdir: ((0, o.join))(s, './dist'),
    metafile: !0,
    external: ['$sendary-manifest', '$sendary-client', '$sendary-router', '$sendary-pages'],
    jsx: 'automatic',
    plugins: [((0, r.nodeExternalsPlugin))({
      packagePath: ((0, o.join))(s, 'package.json')
    }), i.esmSplitCodeToCjs]
  };
  (console.log(a), ((0, e.build))((function (e, r) {
    return (r = null != r ? r : {}, Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : (function (e, r) {
      var t = Object.keys(e);
      if (Object.getOwnPropertySymbols) {
        var n = Object.getOwnPropertySymbols(e);
        t.push.apply(t, n);
      }
      return t;
    })(Object(r)).forEach(function (t) {
      Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(r, t));
    }), e);
  })((function (e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {}, n = Object.keys(t);
      ("function" == typeof Object.getOwnPropertySymbols && (n = n.concat(Object.getOwnPropertySymbols(t).filter(function (e) {
        return Object.getOwnPropertyDescriptor(t, e).enumerable;
      }))), n.forEach(function (r) {
        var n;
        (n = t[r], (r in e) ? Object.defineProperty(e, r, {
          value: n,
          enumerable: !0,
          configurable: !0,
          writable: !0
        }) : e[r] = n);
      }));
    }
    return e;
  })({}, p), {
    format: 'esm',
    bundle: !0,
    chunkNames: 'chunks/[hash]',
    minifySyntax: !0,
    outExtension: {
      '.js': '.mjs'
    },
    define: {
      __DEV__: (!u).toString()
    }
  })));
}
 }),
/* D:\nudo\scripts\splitting.ts */ "1": (function(__serpack_require__,__non_serpack_require__,module,exports) { var e;
(Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "esmSplitCodeToCjs", {
  enumerable: !0,
  get: function () {
    return o;
  }
}));
const t = (e = __serpack_require__("esbuild")) && e.__esModule ? e : {
  default: e
};
function n(e, t, n, o, r, i, u) {
  try {
    var s = e[i](u), l = s.value;
  } catch (e) {
    n(e);
    return;
  }
  s.done ? t(l) : Promise.resolve(l).then(o, r);
}
const o = {
  name: 'esmSplitCodeToCjs',
  setup(e) {
    e.onEnd(o => {
      var r;
      return ((r = function* () {
        var n, r;
        let i = Object.keys(null != (r = null == (n = o.metafile) ? void 0 : n.outputs) ? r : {}).filter(e => e.endsWith('mjs') || e.endsWith('js'));
        yield t.default.build({
          outdir: e.initialOptions.outdir,
          entryPoints: i,
          allowOverwrite: !0,
          format: 'cjs',
          logLevel: 'info',
          outExtension: {
            '.js': '.js'
          }
        });
      }, function () {
        var e = this, t = arguments;
        return new Promise(function (o, i) {
          var u = r.apply(e, t);
          function s(e) {
            n(u, o, i, s, l, "next", e);
          }
          function l(e) {
            n(u, o, i, s, l, "throw", e);
          }
          s(void 0);
        });
      }))();
    });
  }
};
 }),
});