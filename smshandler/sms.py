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

PHANTA_HOST = "10.8.0.6"
PHANTA_PORT = "80"
PHANTA_URL = "http://"+PHANTA_HOST+":"+PHANTA_PORT

def send_sms_direct(cellnr, mesg):
    try:
        os.system(r'/opt/phanta/sendsms '+cellnr+' "'+mesg+'"')
        return 0
    except:
        print "BIG ERROR - CANNOT SEND SMS!!!"
        fail(11, "Couldn't send SMS", cellnr+" "+mesg)
        return -1

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
    if (params[-1]=="www.vodacom.co.za"): params.pop()  # FIXME
    print "Message [split]:", params
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
        #sendsms(cellnr, "Unknown command")
        pass


if __name__ == "__main__":
    main()
