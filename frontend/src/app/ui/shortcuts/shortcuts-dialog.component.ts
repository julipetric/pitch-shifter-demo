import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';

/**
 * Reference card of the keyboard shortcuts, shown as a light-dismiss popover.
 *
 * The host element is the popover itself: a button anywhere in the page opens it with
 * `popovertarget` and the id the parent gives the host, and `toggle()` serves the `?` key.
 * Escape and a click outside close it.
 */
@Component({
  selector: 'app-shortcuts-dialog',
  templateUrl: './shortcuts-dialog.component.html',
  styleUrl: './shortcuts-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    popover: 'auto',
    role: 'dialog',
    'aria-labelledby': 'shortcuts-title',
  },
})
export class ShortcutsDialogComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Opens the card when it is closed and closes it when it is open. */
  toggle(): void {
    this.host.nativeElement.togglePopover?.();
  }
}
