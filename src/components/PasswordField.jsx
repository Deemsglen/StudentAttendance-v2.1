import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "../utils/password";
export default function PasswordField({
  label = "Password",
  name = "password",
  value,
  onChange,
  minLength,
  autoComplete = "current-password",
  required = true,
}) {
  const id = useId(),
    [visible, setVisible] = useState(false),
    [local, setLocal] = useState("");
  const text = value ?? local;
  const strength = passwordStrength(text);
  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={text}
          onChange={(e) => {
            setLocal(e.target.value);
            onChange?.(e);
          }}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          aria-describedby={`${id}-strength`}
        />
        <button
          type="button"
          className="icon-button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <div id={`${id}-strength`} className="password-strength">
        <div className={`strength-track strength-${strength.score}`}>
          <span style={{ width: `${strength.score * 25}%` }} />
        </div>
        <small>
          Strength: <strong>{strength.label}</strong>
        </small>
        {text && <small className="muted">{strength.hint}</small>}
      </div>
    </div>
  );
}
