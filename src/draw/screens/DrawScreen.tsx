import {useState} from 'react'
import {StyleSheet, Text, View} from 'react-native'

import * as Layout from '#/components/Layout'
import {DrawSurface} from '#/draw/components/DrawSurface'

/**
 * Dev-only harness for the drawing engine, reachable via the __DEV__
 * `/sys/draw` route. The real entry point is the composer's Draw button; this
 * exists to exercise the engine in isolation and reports the flattened file
 * instead of attaching it to a post.
 */
export function DrawScreen() {
  const [result, setResult] = useState<string>('')

  return (
    <Layout.Screen>
      <View style={styles.surface}>
        <DrawSurface
          onDone={r => setResult(`${r.width}x${r.height} -> ${r.uri}`)}
          onCancel={() => setResult('cancelled')}
          onError={e => setResult(`export failed: ${String(e)}`)}
        />
      </View>
      {/* Bottom padding keeps the controls clear of the shell tab bar (harness only). */}
      <View style={styles.footer}>
        {result !== '' && (
          <Text testID="draw-export-result" style={styles.resultText}>
            {result}
          </Text>
        )}
      </View>
    </Layout.Screen>
  )
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
  },
  footer: {
    paddingBottom: 160,
  },
  resultText: {
    paddingHorizontal: 12,
    paddingTop: 4,
    fontSize: 11,
    color: '#374151',
  },
})
