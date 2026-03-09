# EmailJS Template: Reservation Accepted (Detailed)

Use this template when admin/barber accepts the reservation.

## Template Name
`reservation_confirmed`

## Suggested Subject
`Istanbul Salon - Reservation Confirmed`

## HTML Content (paste in EmailJS template body)
```html
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; color: #222; padding: 14px 8px; background: #f5f5f5;">
  <div style="max-width: 620px; margin: auto; background: #fff;">
    <div style="border-top: 6px solid #111827; padding: 16px;">
      <span style="font-size: 18px; vertical-align: middle;"><strong>Reservation Confirmed</strong></span>
    </div>

    <div style="padding: 0 16px 16px 16px;">
      <p>Hello <strong>{{client_name}}</strong>,</p>
      <p>Your reservation has been accepted. Here is your booking summary:</p>

      <div style="text-align: left; font-size: 14px; padding-bottom: 6px; border-bottom: 2px solid #111827;">
        <strong>Date: {{appointment_date}} | Time: {{appointment_time}}</strong>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Services</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{services_summary}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Barber</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{barber_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Branch</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{branch_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Total Duration</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{total_duration}} min</td>
        </tr>
        <tr>
          <td style="padding: 14px 0; border-top: 2px solid #111827;"><strong>Total Price</strong></td>
          <td style="padding: 14px 0; border-top: 2px solid #111827; text-align: right;"><strong>${{total_price}}</strong></td>
        </tr>
      </table>

      <p style="margin-top: 14px;">
        Need help? Call us at <strong>{{salon_phone}}</strong><br />
        Address: <strong>{{salon_address}}</strong>
      </p>

      <p style="margin-bottom: 0;">We look forward to seeing you.<br />Istanbul Salon Team</p>
    </div>
  </div>
</div>
```

## Plain Text Fallback
```text
Hello {{client_name}},

Your reservation has been accepted.

Date: {{appointment_date}}
Time: {{appointment_time}}
Services: {{services_summary}}
Barber: {{barber_name}}
Branch: {{branch_name}}
Total Duration: {{total_duration}} min
Total Price: ${{total_price}}

Phone: {{salon_phone}}
Address: {{salon_address}}

Istanbul Salon Team
```

## Variables Used (sent by backend)
- `{{client_name}}`
- `{{services_summary}}`
- `{{service_name}}`
- `{{barber_name}}`
- `{{branch_name}}`
- `{{appointment_date}}`
- `{{appointment_time}}`
- `{{total_duration}}`
- `{{total_price}}`
- `{{salon_phone}}`
- `{{salon_address}}`
- `{{event_type}}` = `reservation_confirmed`
