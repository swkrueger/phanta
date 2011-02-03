#!/usr/bin/env python
# Keegan Carruthers-Smith 2010

from mechanize import Browser
from sys import argv, stderr, exit

LOGIN_URL = "https://www.vodacom.co.za/portal/site/myaccount/template.VCOMLOGIN/"
SMS_URL   = "https://www.vodacom.co.za/portal/site/myaccount/sms/"

def send_sms_voda(user, pword, number, txt):
    if user[0] == '0':
        user = '27' + user[1:]

    br = Browser()

    # Set user-agent
    headers = dict(br.addheaders)
    headers["User-agent"] = "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9) Gecko/2008052912 Firefox/3.0"
    br.addheaders = headers.items()

    # Login
    br.open(LOGIN_URL)
    br.select_form(nr=1)
    br["logon"]    = user
    br["password"] = pword
    print "Logging in..."
    br.submit()

    # Send SMS
    br.open(SMS_URL)
    br.select_form(nr=1)
    br["destinationNumber"] = number
    br["messageBody"]       = txt

    # Thanks for using shitty code Vodacom. We have to extract the submission
    # url from the javascript code in the document.
    page = br.response().read()
    x = page.find('function validateFormInput()')
    x = page.find('var actionURL', x)
    actionURLStart = page.find("'", x) + 1
    actionURLEnd   = page.find("'", actionURLStart)
    actionURL      = page[actionURLStart:actionURLEnd]
    br.form.action = 'https://www.vodacom.co.za' + actionURL

    print "Sending message..."
    br.submit()

    response = br.response().read()
    if 'Your SMS has been delivered successfully.' in response:
        print "Message sent"
    else:
        print >>stderr, "Message sending failed. See /tmp/vodacom.html to see the response."
        file('/tmp/vodacom.html', 'w').write(response)
        exit(1)


if __name__ == "__main__":
    if len(argv) < 5:
        print "USAGE: %s yournumber password targetnumber message..." % argv[0]
    else:
        send_sms(argv[1], argv[2], argv[3], ' '.join(argv[4:]))
