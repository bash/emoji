import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify'
import resolve from 'rollup-plugin-node-resolve'

const isProduction = process.env[ 'BUILD_ENV' ] === 'production'

const plugins = [
  resolve({
    jsnext: true,
    modulesOnly: true
  }),
  babel({
    babelrc: false,
    comments: false,
    presets: [
      [
        'env',
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
      'external-helpers',
      'transform-class-properties',
      'transform-node-env-inline',
      'transform-object-rest-spread',
      [
        'transform-react-jsx', { 'pragma': 'h' }
      ]
    ]
  })
]

if (isProduction) {
  plugins.push(uglify())
}

export default {
  plugins: plugins,
  sourceMap: !isProduction,
  format: 'iife'
}