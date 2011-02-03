#!/usr/bin/env python

"""*******************************************************
   * Schalk-Willem Kruger                                *
   * Phanta SMS script                                   *
   *******************************************************"""

import os
import sys
import urllib2
from urllib import urlencode
import httplib

from mechanize import Browser
from sys import argv, stderr, exit

LOGIN_URL = "https://www.vodacom.co.za/portal/site/myaccount/template.VCOMLOGIN/"
SMS_URL   = "https://www.vodacom.co.za/portal/site/myaccount/sms/"

#PHANTA_HOST = "10.8.0.6"
#PHANTA_PORT = "80"
PHANTA_HOST = "127.0.0.1"
PHANTA_PORT = "8080"
PHANTA_URL = "http://"+PHANTA_HOST+":"+PHANTA_PORT

def send_sms_voda(user, pword, number, txt):
    if user[0] == '0':
        user = '27' + user[1:]

    br = Browser()
    br.set_proxies({"http": "pta-proxy.csir.co.za:3128",
                })


    # Set user-agent
    headers = dict(br.addheaders)
    headers["User-agent"] = "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9) Gecko/2008052912 Firefox/3.0"
    br.addheaders = headers.items()

    # Login
    res = br.open(LOGIN_URL)
    html = res.read()
    print html
    br.select_form(name="login_form")
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

def fail(errcode, error, msg):
    print errocode, error, msg

def send_sms_direct(cellnr, mesg):
    try:
        os.system(r'/opt/phanta/sendsms '+cellnr+' "'+mesg+'"')
        return 0
    except:
        print "BIG ERROR - CANNOT SEND SMS!!!"
        fail(11, "Couldn't send SMS", cellnr+" "+mesg)
        return -1

def send_sms_vodacom(cellnr, mesg):
    send_sms_voda("XXXXXXXXXXX", "Y", cellnr, mesg)

def send_sms(cellnr, mesg):
    if (len(mesg)>128): mesg=mesg[:128]
    print "Sending SMS to", cellnr, "Message:", mesg
    send_sms_direct(cellnr, mesg)
    #send_sms_vodacom(cellnr, mesg)

def doreq(method, url, postdata="", headers={}):
    #f = urllib2.urlopen(PHANTA_URL+"/pubsub/publish?smsd=true", "message="+msg)
    print "Request:", method, url, postdata, headers
    conn = httplib.HTTPConnection(PHANTA_HOST+":"+PHANTA_PORT)
    conn.request(method, url, postdata, headers)
    response = conn.getresponse()
    print response.status, response.reason
    data = response.read()
    print data
    conn.close()
    return response.status, data

def pubsub_post(cellnr, msg):
    print "Pubsub post"
    status, data = doreq("POST", "/pubsub/publish?smsnr="+cellnr, "message="+msg)
    if (status==302 or status==200):
        #send_sms(cellnr, "Your message has been published")
        pass
    else: send_sms(cellnr, "Error: "+data)

def auth_register(cellnr):
    print "Register"
    status, data = doreq("POST", "/auth/register", urlencode({"cellphone": cellnr, "hash": "SMSHANDLER"}))
    if (status==302 or status==200):
        send_sms(cellnr, "Your cellphone number "+cellnr+" has been registered successfully")
    else: send_sms(cellnr, "Error: "+data)

def profiles_follow(cellnr, user):
    print "Follow"
    status, data = doreq("POST", "/profiles/following?smsnr="+cellnr, "username="+user)
    # TODO: Reply
    if (status==302 or status==200):
        send_sms(cellnr, "Your are now following "+user)
    else: send_sms(cellnr, "Error: "+data)

def profiles_unfollow(cellnr, user):
    print "Follow"
    status, data = doreq("DELETE", "/profiles/following?smsnr="+cellnr+"&username="+user)
    if (status==302 or status==200):
        send_sms(cellnr, "Your are not following "+user+" anymore")
    else: send_sms(cellnr, "Error: "+data)
    # TODO: Reply

def main():
    if len(sys.argv)<2:
        print "Error with parameters!"
        fail(7, "Error with SMS script parameters", "==SMS==ERROR==")
    f = open(sys.argv[1], "r")
    global g_cellnr
    s = f.readline()
    while (len(s)!=1):
        if s.split()[0]=="From:": cellnr = s.split()[1]
        s = f.readline()
    if (cellnr[:2]=="27"): cellnr="0"+cellnr[2:]
    g_cellnr = cellnr
    print "New message from", cellnr
    mes = ""
    while (s!=''):
        mes+=s.strip()
        s = f.readline()
    print "Message:", mes
    params = mes.split()
    print "Message [split]:", params
    print "params", params
    if (params[-1]=="vodacom.co.za"): params.pop()  # FIXME
    cmd = params.pop(0).lower()
    # TODO: Proper dispatcher
    if (cmd=="post" or cmd=="p"):
        pubsub_post(cellnr, " ".join(params))
    elif (cmd=="register" or cmd=="r"):
        auth_register(cellnr)
    elif (cmd=="follow" or cmd=="f"):
        profiles_follow(cellnr, params.pop(0).lower())
    elif (cmd=="unfollow" or cmd =="u"):
        profiles_follow(cellnr, params.pop(0).lower())
    else:
        sendsms(cellnr, "Unknown command")



if __name__ == "__main__":
    main()
