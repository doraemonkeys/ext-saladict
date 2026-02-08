import {
  filter,
  map,
  switchMap,
  delay,
  debounceTime,
  mergeMap,
  takeUntil,
  mapTo
} from 'rxjs/operators'
import { of, Observable, OperatorFunction, from } from 'rxjs'
// MV3: Avoid importing from 'react' here — this module is used by the
// background Service Worker (via badge.ts → switchMapBy) and importing
// React would crash the SW with "window is not defined".
// hover / hoverWithDelay are only used by frontend code.
interface SyntheticMouseEvent<N extends Node = Node> {
  type: string
  relatedTarget: EventTarget | null
  currentTarget: N
}

/**
 * Reusable Observable logics
 */

/**
 * Emits true on mouse enter and false on mouse leave.
 * Delay on mouse enter.
 *
 * Shadow DOM does not send mouseenter and mouseleave
 * cross the boundary which means React synthetic
 * event handler will not collect.
 * Here mouseover and mouseout are used to simulate.
 *
 * @param event$ mouseover and mouseout events
 */
export function hover<N extends Node>(
  event$: Observable<SyntheticMouseEvent<N>>
): Observable<boolean> {
  return event$.pipe(
    filter(
      e =>
        e.relatedTarget !== e.currentTarget &&
        (!(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget))
    ),
    map(e => e.type === 'mouseover')
  )
}

/**
 * [[hover]] with delay on enter.
 */
export function hoverWithDelay<N extends Node>(
  event$: Observable<SyntheticMouseEvent<N>>
): Observable<boolean> {
  return hover(event$).pipe(
    // delay enter but not leave
    switchMap(isEnter => of(isEnter).pipe(delay(isEnter ? 500 : 100)))
  )
}

/**
 * Emits true is focus and false if blur.
 */
export function focusBlur(event$: Observable<{ type: string }>) {
  return event$.pipe(
    map(e => e.type !== 'blur'),
    debounceTime(100)
  )
}

/**
 *
 * SwitchMap when value on specific key changes.
 */
export function switchMapBy<T, R>(
  key: keyof T,
  mapFn: (val: T) => Observable<R> | Promise<R>
): OperatorFunction<T, R> {
  return input$ => {
    return input$.pipe(
      mergeMap(val =>
        from(mapFn(val)).pipe(
          takeUntil(input$.pipe(filter(input => input[key] === val[key])))
        )
      )
    )
  }
}

export function mapToTrue<T>(input$: Observable<T>) {
  return mapTo(true)(input$)
}
