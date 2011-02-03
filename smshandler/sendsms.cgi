#!/bin/bash


CELLNR=`echo "$QUERY_STRING" | sed -n 's/^.*cellnr=\([^&]*\).*$/\1/p' | sed "s/%20/ /g"`
MESSAGE=$(</dev/stdin)

if [ $CELLNR ] && [ $MESSAGE ]
then
    
else
    echo "Status: 400 Bad Request"
    echo ""
    echo "Content-type: text/plain\n"
    echo ""
    echo "Please specify message and cellphone number"
fi

echo "Status: 200 OK"
echo ""
echo "Content-type: text/plain\n"
echo ""
./sendsms $CELLNR $MESSAGE
