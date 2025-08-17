import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ open, onClose, title, children, actions }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl ring-1 ring-gray-200/60 dark:ring-gray-700 p-5"
            >
              {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>}
              <div>{children}</div>
              {actions && <div className="mt-4 flex justify-end gap-2">{actions}</div>}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
