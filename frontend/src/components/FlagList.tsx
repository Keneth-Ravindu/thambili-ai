import type { Flag } from '../types'

export function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) {
    return <p className="flag-empty">No issues found - looks ready to approve.</p>
  }
  return (
    <ul className="flag-list">
      {flags.map((flag, i) => (
        <li key={i} className={`flag flag-${flag.severity}`}>
          <span className="flag-severity">{flag.severity}</span>
          <span className="flag-message">{flag.message}</span>
        </li>
      ))}
    </ul>
  )
}
