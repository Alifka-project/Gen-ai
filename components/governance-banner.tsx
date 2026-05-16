// Persistent governance banner — brief §25 and proposal §21.3.
// "AI output is advisory. Final decision belongs to the authorized manager."

export function GovernanceBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900">
      <strong>AI output is advisory.</strong> Final decision belongs to the authorised manager.
    </div>
  );
}
