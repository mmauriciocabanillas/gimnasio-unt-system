// El aforo corresponde a un día y un bloque horario, no a la suma semanal.
export const SESSION_CAPACITY = 20;

export function dailyCapacity(dashboard) {
  const day = new Date(`${dashboard.today}T12:00:00Z`).getUTCDay();
  return dashboard.byBlock.map(block => ({
    start: block.start,
    occupied: dashboard.slots.find(slot => slot.day === day && slot.start === block.start)?.occupied || 0,
    capacity: SESSION_CAPACITY,
  }));
}
