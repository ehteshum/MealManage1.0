import { motion } from 'framer-motion';

export default function Card({ title, value, Icon, color = 'from-blue-500 to-indigo-500' }) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      className="relative rounded-xl p-5 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-700/40 bg-white dark:bg-gray-900 overflow-hidden"
    >
      <div className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r ${color} opacity-20`} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
        </div>
        {Icon && (
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-gray-900 to-gray-700 text-white dark:from-gray-100 dark:to-gray-300 dark:text-gray-900">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
