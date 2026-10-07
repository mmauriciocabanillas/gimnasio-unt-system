export const MAX_DAYS = 3;

export function enforceDayLimit(selects, changed) {
  let rejected = false;
  if (selects.filter(select => select.value).length > MAX_DAYS && changed) {
    changed.value = '';
    rejected = true;
  }
  const count = selects.filter(select => select.value).length;
  for (const select of selects) {
    for (const option of select.options) {
      option.disabled = Boolean(option.value) && (option.dataset.full === 'true' || (count >= MAX_DAYS && !select.value));
    }
  }
  return { count, rejected };
}

// El alumno puede conservar su propio cupo; no ocupar el de otra persona.
export function scheduleAvailability(data, ownReservations = []) {
  return { ...data, slots: data.slots.map(slot => ({ ...slot,
    available: slot.available + (ownReservations.some(reservation => reservation.day === slot.day && reservation.start === slot.start) ? 1 : 0),
  })) };
}
