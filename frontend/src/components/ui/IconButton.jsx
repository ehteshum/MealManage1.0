import { motion } from 'framer-motion';

export default function IconButton({ children, onClick, type = 'button', variant = 'primary', disabled }) {
  const gradient = variant === 'danger'
    ? 'from-rose-500 to-red-500'
    : variant === 'secondary'
    ? 'from-slate-500 to-gray-600'
    : 'from-blue-600 to-indigo-600';
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      whileHover={!disabled ? { y: -1 } : undefined}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white bg-gradient-to-r ${gradient} shadow-sm disabled:opacity-60`}
    >
      {children}
    </motion.button>
  );
}
