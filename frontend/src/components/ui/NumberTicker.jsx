import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

export default function NumberTicker({ value = 0, decimals = 2, prefix = '', suffix = '' }) {
	const mv = useMotionValue(0);
	const rounded = useTransform(mv, (latest) => {
		const v = Number.isFinite(latest) ? latest : 0;
		const d = Math.max(0, Math.min(6, Number(decimals) || 0));
		return `${prefix}${v.toFixed(d)}${suffix}`;
	});

		useEffect(() => {
		const to = Number.isFinite(Number(value)) ? Number(value) : 0;
		const controls = animate(mv, to, { type: 'spring', stiffness: 120, damping: 20 });
		return controls.stop;
		}, [value, mv]);

	return (
		<motion.span aria-live="polite">{rounded}</motion.span>
	);
}

