import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Login() {
  const [email, setEmail] = useState('admin@inventariojudicial.local');
  const [password, setPassword] = useState('Admin1234');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      // Guardar token
      localStorage.setItem('token', response.data.token);

      // Guardar usuario
      localStorage.setItem('usuario', JSON.stringify(response.data.usuario));

      // Redirigir al dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al iniciar sesión');
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1>Inventario Judicial</h1>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.button}>
          Ingresar
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f4f6f8',
  },
  form: {
    background: '#fff',
    padding: '2rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  input: {
    padding: '0.85rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
  },
  button: {
    padding: '0.9rem',
    border: 'none',
    borderRadius: '8px',
    background: '#1f4f82',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  error: {
    color: 'crimson',
    margin: 0,
  },
};