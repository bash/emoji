import babel from 'rollup-plugin-babel'
import minify from 'rollup-plugin-babel-minify'
import resolve from 'rollup-plugin-node-resolve'
import rollupTypescript from 'rollup-plugin-typescript'
import typescript from 'typescript'
import tslib from 'tslib'

const isRelease = process.env[ 'BUILD_MODE' ] === 'release'

const plugins = [
  rollupTypescript({ typescript, tslib, tsconfig: 'tsconfig.json' }),
  resolve(),
  babel({
    babelrc: false,
    comments: false,
    presets: [
      [
        '@babel/env',
        {
          'modules': false,
          'targets': {
            'browsers': [
              'last 2 chrome versions',
              'last 2 firefox versions',
              'last 2 safari versions',
              'last 2 ios_saf versions',
              'last 2 edge versions',
            ]
          }
        }
      ]
    ],
    plugins: [
      '@babel/proposal-class-properties',
      '@babel/proposal-object-rest-spread',
      [
        '@babel/transform-react-jsx', { 'pragma': 'h' }
      ]
    ]
  })
]

if (isRelease) {
  plugins.push(minify())
}

export default {
  plugins,
  output: {
    sourcemap: !isRelease,
    format: 'iife',
  },
}
