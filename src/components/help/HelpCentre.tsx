import { useEffect, useRef } from 'react'
import { revealHelpHash } from '../../features/help/navigation'
import { FAQ_CATEGORIES } from '../../features/help/faq'
import { COMPANY } from '../../features/legal/company'
import { LegalLayout } from '../legal/LegalLayout'
import './Help.css'

export function HelpCentre() {
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reveal = () => revealHelpHash(content.current)
    // Let the book finish its spread-level focus/scroll reset before revealing a deep link.
    const frame = requestAnimationFrame(reveal)
    window.addEventListener('hashchange', reveal)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', reveal) }
  }, [])
  return <LegalLayout title="Help & FAQs" updated="28 October 2026">
    <div className="help-centre" ref={content}>
      <p>A little help with choosing a set, ordering and what happens next. For individual help, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.</p>
      <nav className="help-categories" aria-label="Help categories">{FAQ_CATEGORIES.map(category => <a key={category.id} href={`#${category.id}`}>{category.title}</a>)}</nav>
      {FAQ_CATEGORIES.map(category => <section key={category.id} aria-labelledby={`${category.id}-heading`}>
        <h3 id={category.id} tabIndex={-1}><span id={`${category.id}-heading`}>{category.title}</span></h3>
        {category.questions.map(question => <details className="help-question" id={question.id} key={question.id}>
          <summary>{question.question}</summary>
          <div className="help-answer"><p>{question.answer}</p><a className="help-question-link" href={`/help#${question.id}`}>Link to this question</a></div>
        </details>)}
      </section>)}
    </div>
  </LegalLayout>
}
