import babel from 'rollup-plugin-babel'
import minify from 'rollup-plugin-babel-minify'
import resolve from 'rollup-plugin-node-resolve'

const isRelease = process.env[ 'BUILD_MODE' ] === 'release'

const plugins = [
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
