# EmailJS Templates: Rejected and Postponed

Use these templates in EmailJS for reservation status updates.

## 1) Reservation Rejected

### Suggested Subject
`Istanbul Salon - Reservation Update`

### HTML
```html
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; color: #222; padding: 14px 8px; background: #f5f5f5;">
  <div style="max-width: 620px; margin: auto; background: #fff;">
    <div style="border-top: 6px solid #b91c1c; padding: 16px;">
      <strong style="font-size: 18px;">Reservation Not Accepted</strong>
    </div>

    <div style="padding: 0 16px 16px 16px;">
      <p>Hello {{client_name}},</p>
      <p>We are sorry, but your reservation request could not be accepted at this time.</p>

      <div style="margin: 12px 0; padding: 12px; border: 1px solid #e5e7eb; background: #fafafa;">
        <strong>Update:</strong><br />
        {{message}}
      </div>

      <p>You can submit a new request with another time slot.</p>
      <p style="margin-bottom: 0;">Istanbul Salon Team</p>
    </div>
  </div>
</div>
```

### Plain Text
```text
Hello {{client_name}},

Your reservation request could not be accepted.

Update:
{{message}}

You can submit a new request with another time slot.
Istanbul Salon Team
```

## 2) Reservation Postponed

### Suggested Subject
`Istanbul Salon - Reservation Postponed`

### HTML
```html
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; color: #222; padding: 14px 8px; background: #f5f5f5;">
  <div style="max-width: 620px; margin: auto; background: #fff;">
    <div style="border-top: 6px solid #b45309; padding: 16px;">
      <strong style="font-size: 18px;">Reservation Postponed</strong>
    </div>

    <div style="padding: 0 16px 16px 16px;">
      <p>Hello {{client_name}},</p>
      <p>Your reservation has been postponed by the salon team.</p>

      <div style="margin: 12px 0; padding: 12px; border: 1px solid #e5e7eb; background: #fafafa;">
        <strong>New update:</strong><br />
        {{message}}
      </div>

      <p>Please check your reservation and confirm the new time if it works for you.</p>
      <p style="margin-bottom: 0;">Istanbul Salon Team</p>
    </div>
  </div>
</div>
```

### Plain Text
```text
Hello {{client_name}},

Your reservation has been postponed.

New update:
{{message}}

Please check your reservation and confirm the new time.
Istanbul Salon Team
```

## Variables You Can Use
- `{{client_name}}`
- `{{message}}`
- `{{subject}}`
- `{{to_email}}`
