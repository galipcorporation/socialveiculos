import { useState, type CSSProperties, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperStyle?: CSSProperties
}

/** Input de senha com botão de olho para revelar o valor digitado. */
export function PasswordInput({ wrapperStyle, style, className, ...rest }: Props) {
  const [visivel, setVisivel] = useState(false)

  return (
    <div style={{ position: 'relative', ...wrapperStyle }}>
      <input
        {...rest}
        type={visivel ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: 40 }}
      />
      <button
        type="button"
        className="btn-toggle-password"
        onClick={() => setVisivel(!visivel)}
        tabIndex={-1}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
