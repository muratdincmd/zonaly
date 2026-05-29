; NSIS installer hooks for Zonaly
; Runs after installation AND after upgrades (POSTINSTALL fires in both cases).

!macro NSIS_HOOK_POSTINSTALL
  ; Force Windows Shell to rebuild icon caches so the Zonaly
  ; shortcut icon appears immediately without a reboot or manual cache clear.

  ; 1. Clear the legacy icon cache (XP–Win10 compat)
  System::Call 'ie4uinit.exe -ClearIconCache'

  ; 2. Notify the shell that all file associations / icons have changed.
  ;    0x8000000 = SHCNF_IDLIST | SHCNE_ASSOCCHANGED
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
